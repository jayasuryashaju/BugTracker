from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Bug, Attachment, Comment, Organization, OrganizationInvite, Notification, UserProfile, Project, Tag, WorkLog, SavedFilter
from .serializers import (
    BugSerializer, AttachmentSerializer, CommentSerializer, UserSerializer,
    OrganizationSerializer, OrganizationInviteSerializer, NotificationSerializer, ProjectSerializer,
    TagSerializer, WorkLogSerializer, SavedFilterSerializer
)
from django.contrib.auth.models import User
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def broadcast_bug_event(bug, action):
    if not bug.organization:
        return
    channel_layer = get_channel_layer()
    if channel_layer:
        serializer = BugSerializer(bug)
        async_to_sync(channel_layer.group_send)(
            f'org_{bug.organization.id}',
            {
                'type': 'send_bug_event',
                'data': {
                    'action': action,
                    'bug': serializer.data
                }
            }
        )

def create_notification(recipient, actor, bug, notification_type, title, message):
    if recipient and recipient != actor:
        notification = Notification.objects.create(
            recipient=recipient,
            actor=actor,
            bug=bug,
            notification_type=notification_type,
            title=title,
            message=message
        )
        
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'user_{recipient.id}',
                {
                    'type': 'send_notification',
                    'notification': {
                        'id': str(notification.id),
                        'title': notification.title,
                        'message': notification.message,
                        'notification_type': notification.notification_type,
                        'is_read': notification.is_read,
                        'created_at': notification.created_at.isoformat(),
                        'actor_name': actor.first_name or actor.username if actor else 'System',
                        'bug': str(bug.id) if bug else None,
                    }
                }
            )

class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.organization:
            return Organization.objects.filter(id=user.profile.organization.id)
        return Organization.objects.none()

    @action(detail=False, methods=['get', 'patch', 'put'])
    def current(self, request):
        user = request.user
        if not hasattr(user, 'profile') or not user.profile.organization:
            return Response({'error': 'No organization found'}, status=400)
            
        org = user.profile.organization
        if request.method in ['PATCH', 'PUT']:
            role = user.profile.role
            if role != 'Admin' and not user.is_superuser:
                return Response({'error': 'Only Organization Admins can edit organization settings.'}, status=403)
            serializer = OrganizationSerializer(org, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)

        serializer = OrganizationSerializer(org)
        return Response(serializer.data)

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'profile') or not user.profile.organization:
            return Project.objects.none()

        org = user.profile.organization
        role = user.profile.role

        qs = Project.objects.select_related('created_by', 'organization', 'created_by__profile').prefetch_related('members').order_by('-created_at')
        if role in ['Admin', 'Manager'] or user.is_superuser:
            return qs.filter(organization=org)

        return qs.filter(organization=org, members=user).distinct()

    def create(self, request, *args, **kwargs):
        role = request.user.profile.role if hasattr(request.user, 'profile') else 'Developer'
        if role not in ['Admin', 'Manager'] and not request.user.is_superuser:
            return Response({'detail': 'Only Admins and Managers can create projects.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        org = user.profile.organization
        serializer.save(organization=org, created_by=user)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.organization:
            return User.objects.filter(profile__organization=user.profile.organization, profile__status='Active')
        return User.objects.filter(id=user.id)

class OrganizationInviteViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationInviteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.organization:
            return OrganizationInvite.objects.filter(organization=user.profile.organization)
        return OrganizationInvite.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        org = user.profile.organization
        email = serializer.validated_data.get('email')
        role = serializer.validated_data.get('role', 'Developer')

        existing = OrganizationInvite.objects.filter(organization=org, email__iexact=email).first()
        if existing:
            existing.role = role
            existing.accepted = False
            existing.invited_by = user
            existing.save()
        else:
            serializer.save(organization=org, invited_by=user)

class BugViewSet(viewsets.ModelViewSet):
    serializer_class = BugSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to', 'project']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'priority']

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'profile') or not user.profile.organization:
            return Bug.objects.none()

        org = user.profile.organization
        role = user.profile.role

        base_qs = Bug.objects.select_related(
            'created_by', 'created_by__profile', 'created_by__profile__organization',
            'assigned_to', 'assigned_to__profile', 'assigned_to__profile__organization',
            'project', 'project__organization', 'project__created_by'
        ).prefetch_related(
            'attachments', 'attachments__uploaded_by',
            'comments', 'comments__author', 'comments__replies',
            'activity_logs', 'activity_logs__actor',
            'tags',
            'linked_bugs',
            'work_logs', 'work_logs__user'
        ).filter(organization=org).order_by('-created_at')

        # Developers only see bugs assigned to them
        if role == 'Developer':
            return base_qs.filter(assigned_to=user)

        return base_qs

    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        org = user.profile.organization if hasattr(user, 'profile') else None
        bug = serializer.save(created_by=user, organization=org)

        from .models import BugActivityLog
        BugActivityLog.objects.create(
            bug=bug,
            actor=user,
            action="Created",
            old_value="",
            new_value="Bug created"
        )

        if bug.assigned_to:
            create_notification(
                recipient=bug.assigned_to,
                actor=user,
                bug=bug,
                notification_type='Assigned',
                title='New Bug Assigned',
                message=f"You have been assigned to bug '{bug.title}'."
            )

        broadcast_bug_event(bug, 'created')

    def perform_update(self, serializer):
        old_bug = self.get_object()
        old_status = old_bug.status
        old_assignee = old_bug.assigned_to
        old_priority = old_bug.priority
        old_due_date = old_bug.due_date

        bug = serializer.save()
        user = self.request.user

        from .models import BugActivityLog

        if old_status != bug.status:
            BugActivityLog.objects.create(bug=bug, actor=user, action="Status Changed", old_value=old_status, new_value=bug.status)
            
            recipient = bug.created_by if user != bug.created_by else bug.assigned_to
            create_notification(
                recipient=recipient,
                actor=user,
                bug=bug,
                notification_type='StatusChanged',
                title='Bug Status Updated',
                message=f"Bug '{bug.title}' status changed from '{old_status}' to '{bug.status}'."
            )

        if old_assignee != bug.assigned_to:
            old_name = old_assignee.username if old_assignee else "Unassigned"
            new_name = bug.assigned_to.username if bug.assigned_to else "Unassigned"
            BugActivityLog.objects.create(bug=bug, actor=user, action="Assignee Changed", old_value=old_name, new_value=new_name)

            if bug.assigned_to:
                create_notification(
                    recipient=bug.assigned_to,
                    actor=user,
                    bug=bug,
                    notification_type='Assigned',
                    title='Bug Assigned',
                    message=f"You have been assigned to bug '{bug.title}'."
                )

        if old_priority != bug.priority:
            BugActivityLog.objects.create(bug=bug, actor=user, action="Priority Changed", old_value=old_priority, new_value=bug.priority)

        if old_due_date != bug.due_date:
            BugActivityLog.objects.create(
                bug=bug, 
                actor=user, 
                action="Due Date Changed", 
                old_value=str(old_due_date) if old_due_date else "None", 
                new_value=str(bug.due_date) if bug.due_date else "None"
            )
            
        broadcast_bug_event(bug, 'updated')

    def perform_destroy(self, instance):
        broadcast_bug_event(instance, 'deleted')
        instance.delete()

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        user = request.user
        if not hasattr(user, 'profile') or not user.profile.organization:
            return Response({'error': 'No organization found'}, status=400)
            
        org = user.profile.organization
        bugs = Bug.objects.filter(organization=org)
        
        total = bugs.count()
        open_count = bugs.filter(status='Open').count()
        in_progress = bugs.filter(status='In Progress').count()
        resolved = bugs.filter(status='Resolved').count()
        closed = bugs.filter(status='Closed').count()
        
        priority_low = bugs.filter(priority='Low').count()
        priority_medium = bugs.filter(priority='Medium').count()
        priority_high = bugs.filter(priority='High').count()
        priority_critical = bugs.filter(priority='Critical').count()
        
        from django.utils import timezone
        from datetime import timedelta
        
        today = timezone.now().date()
        trend = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            next_day = day + timedelta(days=1)
            count = bugs.filter(created_at__gte=day, created_at__lt=next_day).count()
            trend.append({'name': day.strftime('%b %d'), 'bugs': count})
        
        return Response({
            'total': total,
            'status_breakdown': {
                'open': open_count,
                'in_progress': in_progress,
                'resolved': resolved,
                'closed': closed,
            },
            'priority_breakdown': {
                'low': priority_low,
                'medium': priority_medium,
                'high': priority_high,
                'critical': priority_critical,
            },
            'trend': trend,
            'resolution_rate': round((resolved + closed) / total * 100, 1) if total > 0 else 0
        })

class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'profile') or not user.profile.organization:
            return Attachment.objects.none()
        return Attachment.objects.filter(bug__organization=user.profile.organization).order_by('-uploaded_at')

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(uploaded_by=user)

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'profile') or not user.profile.organization:
            return Comment.objects.none()
        return Comment.objects.filter(bug__organization=user.profile.organization).order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        comment = serializer.save(author=user)
        bug = comment.bug

        recipient = bug.assigned_to if user == bug.created_by else bug.created_by
        if recipient:
            create_notification(
                recipient=recipient,
                actor=user,
                bug=bug,
                notification_type='Commented',
                title='New Comment on Bug',
                message=f"{user.first_name or user.username} commented on '{bug.title}': {comment.content[:50]}"
            )
        
        # Broadcast the update so frontends reload the bug comments
        broadcast_bug_event(bug, 'updated')

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        try:
            notification = self.get_object()
            notification.is_read = True
            notification.save()
            return Response({'status': 'notification marked as read'})
        except Notification.DoesNotExist:
            return Response(status=404)

    @action(detail=False, methods=['post'])
    def read_all(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'all notifications marked as read'})

class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'profile') or not user.profile.organization:
            from .models import Tag
            return Tag.objects.none()
        from .models import Tag
        return Tag.objects.filter(organization=user.profile.organization)

    def perform_create(self, serializer):
        user = self.request.user
        org = user.profile.organization if hasattr(user, 'profile') else None
        serializer.save(organization=org)

class WorkLogViewSet(viewsets.ModelViewSet):
    serializer_class = WorkLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.organization:
            return WorkLog.objects.filter(bug__organization=user.profile.organization)
        return WorkLog.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class SavedFilterViewSet(viewsets.ModelViewSet):
    serializer_class = SavedFilterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedFilter.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
