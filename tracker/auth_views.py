import re

import requests
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Organization, OrganizationInvite, UserProfile
from .permissions import FREE_MAIL_DOMAINS

USERNAME_RE = re.compile(r'^[\w.@+-]{3,150}$')


class AuthRateThrottle(AnonRateThrottle):
    scope = 'auth'


def display_name_for(user):
    return (f"{user.first_name} {user.last_name}".strip()) or user.username


def process_user_organization(user, email, default_job_title=''):
    """Attach a freshly authenticated user to an organization.

    Returns (is_new_org, error_message).
    """
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={'position': default_job_title or '', 'working_on': ''}
    )

    # 1. An explicit invitation always wins.
    invite = OrganizationInvite.objects.filter(email__iexact=email, accepted=False).order_by('-created_at').first()
    if invite:
        invite.accepted = True
        invite.save(update_fields=['accepted'])
        profile.organization = invite.organization
        profile.role = invite.role
        profile.status = 'Active'
        profile.position = profile.position or default_job_title
        profile.save()
        return False, None

    # 2. Already in an organization.
    if profile.organization and profile.status == 'Active':
        return False, None

    domain = email.split('@')[-1].lower() if '@' in email else 'default.com'

    # 3. Public mail providers (gmail.com, outlook.com...) never share a workspace:
    #    each person gets a private one and can invite others into it.
    if domain in FREE_MAIL_DOMAINS:
        org = Organization.objects.create(
            name=f"{display_name_for(user)}'s Workspace",
            domain=email,
        )
        profile.organization = org
        profile.role = 'Admin'
        profile.status = 'Active'
        profile.position = profile.position or default_job_title or 'Workspace Owner'
        profile.save()
        return True, None

    # 4. Company domains: the first person creates the organization and becomes Admin.
    org = Organization.objects.filter(domain__iexact=domain).first()
    if not org:
        org = Organization.objects.create(name=domain.split('.')[0].replace('-', ' ').title(), domain=domain)
        profile.organization = org
        profile.role = 'Admin'
        profile.status = 'Active'
        profile.position = profile.position or default_job_title or 'Organization Admin'
        profile.save()
        return True, None

    if user.is_superuser:
        profile.organization = org
        profile.role = 'Admin'
        profile.status = 'Active'
        profile.save()
        return False, None

    return False, (
        f"The organization '{domain}' is already registered in BugTracker Pro. "
        "Ask your organization Admin to send you an invite."
    )


def _tokens_for(user, **extra):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token), **extra}


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def login_view(request):
    identifier = request.data.get('username') or request.data.get('email')
    password = request.data.get('password')

    if not identifier or not password:
        return Response({'error': 'Please provide email/username and password'}, status=status.HTTP_400_BAD_REQUEST)

    identifier = str(identifier).lower().strip()
    user = (
        User.objects.filter(email__iexact=identifier).first()
        or User.objects.filter(username__iexact=identifier).first()
    )

    if not user or not user.is_active or not user.check_password(password):
        return Response({'error': 'Invalid email/username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(_tokens_for(user))


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def register(request):
    email = str(request.data.get('email') or '').strip().lower()
    username = str(request.data.get('username') or '').strip().lower() or email.split('@')[0]
    password = request.data.get('password')
    first_name = str(request.data.get('first_name') or '').strip()[:150]
    last_name = str(request.data.get('last_name') or '').strip()[:150]

    if not email or not username or not password:
        return Response({'error': 'Please provide an email and a password.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_email(email)
    except ValidationError:
        return Response({'error': 'Please enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

    if not USERNAME_RE.match(username):
        username = re.sub(r'[^\w.@+-]', '', username)[:150]
        if len(username) < 3:
            username = email

    try:
        validate_password(password, user=User(username=username, email=email, first_name=first_name, last_name=last_name))
    except ValidationError as e:
        return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account with this email already exists. Try signing in instead.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        username = email  # emails are unique, so this can never collide with another account

    user = User.objects.create_user(username=username, email=email, password=password, first_name=first_name, last_name=last_name)

    is_new_org, error_msg = process_user_organization(user, email)
    if error_msg:
        user.delete()
        return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)

    return Response(_tokens_for(user, is_new_user=True, is_new_org=is_new_org))


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def microsoft_login(request):
    access_token = request.data.get('access_token')
    if not access_token:
        return Response({'error': 'Missing access token'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        graph_response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10,
        )
    except requests.RequestException:
        return Response({'error': 'Could not reach Microsoft to verify your sign-in. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)

    if graph_response.status_code != 200:
        return Response({'error': 'Invalid Microsoft token'}, status=status.HTTP_401_UNAUTHORIZED)

    data = graph_response.json()
    email = (data.get('mail') or data.get('userPrincipalName') or '').strip().lower()
    first_name = data.get('givenName') or ''
    last_name = data.get('surname') or ''
    job_title = data.get('jobTitle') or ''

    if not email:
        return Response({'error': 'Could not extract email from Microsoft account'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email).first() or User.objects.filter(username__iexact=email).first()

    is_new_user = False
    if not user:
        is_new_user = True
        user = User(username=email, email=email, first_name=first_name, last_name=last_name)
        user.set_unusable_password()
        user.save()
    else:
        if not user.is_active:
            return Response({'error': 'This account is disabled.'}, status=status.HTTP_403_FORBIDDEN)
        changed = False
        if not user.first_name and first_name:
            user.first_name, changed = first_name, True
        if not user.last_name and last_name:
            user.last_name, changed = last_name, True
        if changed:
            user.save(update_fields=['first_name', 'last_name'])

    is_new_org, error_msg = process_user_organization(user, email, default_job_title=job_title)
    if error_msg:
        if is_new_user:
            user.delete()
        return Response({'error': error_msg}, status=status.HTTP_403_FORBIDDEN)

    return Response(_tokens_for(user, is_new_user=is_new_user or is_new_org))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    from .serializers import UserSerializer
    return Response(UserSerializer(request.user).data)
