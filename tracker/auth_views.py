import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import UserProfile, Organization, OrganizationInvite
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

def process_user_organization(user, email, requested_role=None, default_job_title=''):
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={'position': default_job_title or '', 'working_on': ''}
    )

    # 1. FIRST check if an explicit OrganizationInvite exists for this email!
    invite = OrganizationInvite.objects.filter(email__iexact=email, accepted=False).first()
    if invite:
        invite.accepted = True
        invite.save()
        profile.organization = invite.organization
        profile.role = invite.role
        profile.status = 'Active'
        profile.position = profile.position or default_job_title
        profile.save()
        return False, None

    # 2. Check if user already has an active organization
    if profile.organization and profile.status == 'Active':
        return False, None

    # 3. Check organization by email domain
    domain = email.split('@')[-1].lower() if '@' in email else 'default.com'
    org = Organization.objects.filter(domain__iexact=domain).first()

    if not org:
        # First user for this domain -> Create Organization and make user Admin
        org_name = domain.split('.')[0].replace('-', ' ').title()
        org = Organization.objects.create(name=org_name, domain=domain)
        profile.organization = org
        profile.role = 'Admin'
        profile.status = 'Active'
        profile.position = profile.position or default_job_title or 'Organization Admin'
        profile.save()
        return True, None
    else:
        # Organization ALREADY exists for this domain and user was NOT invited
        if user.is_superuser:
            profile.organization = org
            profile.role = 'Admin'
            profile.status = 'Active'
            profile.save()
            return False, None
            
        error_msg = f"The organization tenant '{domain}' is already registered in BugTracker Pro. You cannot set up a new account for this domain. Please ask your Organization Admin to send you an invite."
        return False, error_msg

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username_or_email = request.data.get('username') or request.data.get('email')
    password = request.data.get('password')
    
    if not username_or_email or not password:
        return Response({'error': 'Please provide email/username and password'}, status=status.HTTP_400_BAD_REQUEST)
        
    identifier = username_or_email.lower().strip()
    
    user = User.objects.filter(email__iexact=identifier).first() or User.objects.filter(username__iexact=identifier).first()
        
    if not user or not user.check_password(password):
        return Response({'error': 'Invalid email/username or password.'}, status=status.HTTP_401_UNAUTHORIZED)
        
    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name', '')
    last_name = request.data.get('last_name', '')
    role = request.data.get('role', 'Admin')
    
    if not username or not email or not password:
        return Response({'error': 'Please provide username, email, and password'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        validate_password(password)
    except ValidationError as e:
        return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
        
    if User.objects.filter(username__iexact=username).exists() or User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'A user with this username or email already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
    user = User.objects.create_user(
        username=username.lower(),
        email=email.lower(),
        password=password,
        first_name=first_name,
        last_name=last_name
    )
    
    is_new_org, error_msg = process_user_organization(user, email.lower(), requested_role=role)
    if error_msg:
        user.delete()
        return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)
        
    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'is_new_user': True,
        'is_new_org': is_new_org
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def microsoft_login(request):
    access_token = request.data.get('access_token')
    if not access_token:
        return Response({'error': 'Missing access token'}, status=status.HTTP_400_BAD_REQUEST)
        
    headers = {'Authorization': f'Bearer {access_token}'}
    graph_response = requests.get('https://graph.microsoft.com/v1.0/me', headers=headers)
    
    if graph_response.status_code != 200:
        return Response({
            'error': 'Invalid Microsoft token',
            'details': graph_response.json() if graph_response.content else {}
        }, status=status.HTTP_401_UNAUTHORIZED)
        
    data = graph_response.json()
    email = data.get('mail') or data.get('userPrincipalName')
    first_name = data.get('givenName', '')
    last_name = data.get('surname', '')
    job_title = data.get('jobTitle', '')
    
    if not email:
        return Response({'error': 'Could not extract email from Microsoft account'}, status=status.HTTP_400_BAD_REQUEST)
    
    email_clean = email.lower()
    user = User.objects.filter(email__iexact=email_clean).first() or User.objects.filter(username__iexact=email_clean).first()
    
    is_new_user = False
    if not user:
        is_new_user = True
        user = User.objects.create(
            username=email_clean,
            email=email_clean,
            first_name=first_name,
            last_name=last_name,
        )
        user.set_unusable_password()
        user.save()
    else:
        if not user.first_name and first_name:
            user.first_name = first_name
        if not user.last_name and last_name:
            user.last_name = last_name
        user.save()

    is_new_org, error_msg = process_user_organization(user, email_clean, default_job_title=job_title)
    if error_msg:
        if is_new_user:
            user.delete()
        return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'is_new_user': is_new_user or is_new_org,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    from .serializers import UserSerializer
    serializer = UserSerializer(request.user)
    return Response(serializer.data)
