from datetime import timedelta

import django_filters
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.models import User
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Attachment, Bug, BugActivityLog, Comment, Notification, Organization,
    OrganizationInvite, Project, SavedFilter, Tag, UserProfile, WorkLog,
)
from .permissions import can_manage, get_org, get_role, is_admin, visible_bugs
from .serializers import (
    AttachmentSerializer, BugListSerializer, BugSerializer, CommentSerializer,
    NotificationSerializer, OrganizationInviteSerializer, OrganizationSerializer,
    ProjectSerializer, SavedFilterSerializer, TagSerializer, UserSerializer,
    WorkLogSerializer,
)

PRIORITY_RANK = Case(
    When(priority='Critical', then=Value(4)),
    When(priority='High', then=Value(3)),
    When(priority='Medium', then=Value(2)),
    When(priority='Low', then=Value(1)),
    default=Value(0),
    output_field=IntegerField(),
)


def display_name(user):
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username


def _send_to_group(group, payload):
    channel_layer = get_channel_layer()
    if channel_layer:
        try:
            async_to_sync(channel_layer.group_send)(group, payload)
        except Exception:  # realtime is best-effort and must never break a request
            pass


def broadcast_bug_event(bug, action_name):
    """Tell connected clients that a bug changed.

    Only the id is sent; clients refetch through the normal API, which applies
    each user's visibility rules (Developers must not receive other people's bugs).
    """
    if not bug.organization_id:
        return
    _send_to_group(f'org_{bug.organization_id}', {
        'type': 'send_bug_event',
        'data': {'action': action_name, 'bug': {'id': str(bug.id)}},
    })


def create_notification(recipient, actor, bug, notification_type, title, message):
    if not recipient or recipient == actor:
        return None
    notification = Notification.objects.create(
        recipient=recipient, actor=actor, bug=bug,
        notification_type=notification_type, title=title, message=message,
    )
    _send_to_group(f'user_{recipient.id}', {
        'type': 'send_notification',
        'notification': {
            'id': str(notification.id),
            'title': notification.title,
            'message': notification.message,
            'notification_type': notification.notification_type,
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat(),
            'actor': {'id': actor.id, 'username': actor.username, 'first_name': actor.first_name, 'last_name': actor.last_name},
            'bug': str(bug.id) if bug else None,
        },
    })
    return notification


def require_org(user):
    org = get_org(user)
    if org is None:
        raise PermissionDenied('You are not part of an organization.')
    return org


class OrganizationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        org = get_org(self.request.user)
        return Organization.objects.filter(id=org.id) if org else Organization.objects.none()

    @action(detail=False, methods=['get', 'patch', 'put'])
    def current(self, request):
        org = get_org(request.user)
        if org is None:
            return Response({'error': 'No organization found'}, status=status.HTTP_400_BAD_REQUEST)

        if request.method in ('PATCH', 'PUT'):
            if not is_admin(request.user):
                return Response({'error': 'Only Organization Admins can edit organization settings.'}, status=status.HTTP_403_FORBIDDEN)
            serializer = OrganizationSerializer(org, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        return Response(OrganizationSerializer(org).data)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'description', 'prefix']

    def get_queryset(self):
        user = self.request.user
        org = get_org(user)
        if org is None:
            return Project.objects.none()

        qs = (
            Project.objects.select_related('created_by', 'organization', 'created_by__profile')
            .prefetch_related('members', 'members__profile')
            .annotate(
                bug_total=Count('bugs', distinct=True),
                bug_open=Count('bugs', filter=Q(bugs__status__in=['Open', 'In Progress']), distinct=True),
            )
            .filter(organization=org)
            .order_by('-created_at')
        )
        if can_manage(user):
            return qs
        return qs.filter(members=user)

    def _require_manager(self):
        if not can_manage(self.request.user):
            raise PermissionDenied('Only Admins and Managers can manage projects.')

    def perform_create(self, serializer):
        self._require_manager()
        user = self.request.user
        serializer.save(organization=require_org(user), created_by=user)

    def perform_update(self, serializer):
        self._require_manager()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager()
        instance.delete()


class UserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['username', 'first_name', 'last_name', 'email']

    def get_queryset(self):
        user = self.request.user
        org = get_org(user)
        if org is None:
            return User.objects.filter(id=user.id)
        return (
            User.objects.filter(profile__organization=org, profile__status='Active')
            .select_related('profile', 'profile__organization')
            .order_by('first_name', 'username')
        )

    def update(self, request, *args, **kwargs):
        # PUT behaves like PATCH: the client only sends what it wants to change.
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        actor = self.request.user
        target = serializer.instance
        if target.pk != actor.pk and not is_admin(actor):
            raise PermissionDenied('You can only edit your own profile.')

        profile_data = self.request.data.get('profile') or {}
        target_profile = getattr(target, 'profile', None)
        for field in ('role', 'status'):
            if field in profile_data and target_profile and profile_data[field] != getattr(target_profile, field):
                if not is_admin(actor):
                    raise PermissionDenied('Only Organization Admins can change roles.')
        serializer.save()


class OrganizationInviteViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = OrganizationInviteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        org = get_org(self.request.user)
        if org is None:
            return OrganizationInvite.objects.none()
        return OrganizationInvite.objects.filter(organization=org).select_related('invited_by', 'organization').order_by('-created_at')

    def _require_manager(self):
        if not can_manage(self.request.user):
            raise PermissionDenied('Only Admins and Managers can manage invites.')

    def create(self, request, *args, **kwargs):
        self._require_manager()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        org = require_org(user)
        email = serializer.validated_data['email']
        role = serializer.validated_data.get('role', 'Developer')

        if role == 'Admin' and not is_admin(user):
            raise PermissionDenied('Only Admins can invite other Admins.')
        if UserProfile.objects.filter(organization=org, user__email__iexact=email).exists():
            return Response({'email': ['This person is already a member of your organization.']}, status=status.HTTP_400_BAD_REQUEST)

        invite = OrganizationInvite.objects.filter(organization=org, email__iexact=email).first()
        if invite:
            invite.role = role
            invite.accepted = False
            invite.invited_by = user
            invite.save()
            code = status.HTTP_200_OK
        else:
            invite = serializer.save(organization=org, invited_by=user)
            code = status.HTTP_201_CREATED
        return Response(self.get_serializer(invite).data, status=code)

    def perform_destroy(self, instance):
        self._require_manager()
        instance.delete()


class BugFilter(django_filters.FilterSet):
    overdue = django_filters.BooleanFilter(method='filter_overdue')
    unassigned = django_filters.BooleanFilter(method='filter_unassigned')
    mine = django_filters.BooleanFilter(method='filter_mine')

    class Meta:
        model = Bug
        fields = ['status', 'priority', 'assigned_to', 'project', 'created_by', 'tags']

    def filter_overdue(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(due_date__lt=timezone.localdate()).exclude(status__in=['Resolved', 'Closed'])

    def filter_unassigned(self, queryset, name, value):
        return queryset.filter(assigned_to__isnull=True) if value else queryset

    def filter_mine(self, queryset, name, value):
        return queryset.filter(assigned_to=self.request.user) if value else queryset


class BugViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BugFilter
    search_fields = ['title', 'description', 'display_id']
    ordering_fields = ['created_at', 'updated_at', 'priority_rank', 'due_date', 'title', 'status']

    def get_serializer_class(self):
        return BugListSerializer if self.action == 'list' else BugSerializer

    def get_queryset(self):
        qs = visible_bugs(self.request.user).select_related(
            'created_by', 'created_by__profile', 'created_by__profile__organization',
            'assigned_to', 'assigned_to__profile', 'assigned_to__profile__organization',
            'project',
        ).prefetch_related('tags').annotate(priority_rank=PRIORITY_RANK)

        if self.action == 'list':
            qs = qs.annotate(comment_total=Count('comments', distinct=True))
        else:
            qs = qs.prefetch_related(
                'attachments', 'attachments__uploaded_by',
                'comments', 'comments__author', 'comments__author__profile', 'comments__replies',
                'activity_logs', 'activity_logs__actor',
                'linked_bugs', 'work_logs', 'work_logs__user',
            )
        return qs.order_by('-created_at')

    def _check_can_edit(self, bug, user):
        if can_manage(user) or get_role(user) == 'Tester':
            return
        if bug.created_by_id == user.id or bug.assigned_to_id == user.id:
            return
        raise PermissionDenied('You do not have permission to edit this bug.')

    def perform_create(self, serializer):
        user = self.request.user
        bug = serializer.save(created_by=user, organization=require_org(user))

        BugActivityLog.objects.create(bug=bug, actor=user, action="Created", old_value="", new_value="Bug created")

        if bug.assigned_to:
            create_notification(
                recipient=bug.assigned_to, actor=user, bug=bug,
                notification_type='Assigned', title='New bug assigned',
                message=f"You have been assigned to {bug.display_id}: '{bug.title}'.",
            )

        broadcast_bug_event(bug, 'created')

    def perform_update(self, serializer):
        user = self.request.user
        old = serializer.instance
        self._check_can_edit(old, user)

        old_status = old.status
        old_assignee = old.assigned_to
        old_priority = old.priority
        old_due_date = old.due_date

        bug = serializer.save()

        if old_status != bug.status:
            BugActivityLog.objects.create(bug=bug, actor=user, action="Status Changed", old_value=old_status, new_value=bug.status)
            for recipient in {bug.created_by, bug.assigned_to} - {None, user}:
                create_notification(
                    recipient=recipient, actor=user, bug=bug,
                    notification_type='StatusChanged', title='Bug status updated',
                    message=f"{bug.display_id} '{bug.title}' moved from {old_status} to {bug.status}.",
                )

        if old_assignee != bug.assigned_to:
            old_name = display_name(old_assignee) if old_assignee else "Unassigned"
            new_name = display_name(bug.assigned_to) if bug.assigned_to else "Unassigned"
            BugActivityLog.objects.create(bug=bug, actor=user, action="Assignee Changed", old_value=old_name, new_value=new_name)

            create_notification(
                recipient=bug.assigned_to, actor=user, bug=bug,
                notification_type='Assigned', title='Bug assigned to you',
                message=f"You have been assigned to {bug.display_id}: '{bug.title}'.",
            )

        if old_priority != bug.priority:
            BugActivityLog.objects.create(bug=bug, actor=user, action="Priority Changed", old_value=old_priority, new_value=bug.priority)

        if old_due_date != bug.due_date:
            BugActivityLog.objects.create(
                bug=bug, actor=user, action="Due Date Changed",
                old_value=str(old_due_date) if old_due_date else "None",
                new_value=str(bug.due_date) if bug.due_date else "None",
            )

        broadcast_bug_event(bug, 'updated')

    def perform_destroy(self, instance):
        user = self.request.user
        if not (can_manage(user) or instance.created_by_id == user.id):
            raise PermissionDenied('Only Admins, Managers or the reporter can delete a bug.')
        broadcast_bug_event(instance, 'deleted')
        instance.delete()

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        org = get_org(request.user)
        if org is None:
            return Response({'error': 'No organization found'}, status=status.HTTP_400_BAD_REQUEST)

        bugs = visible_bugs(request.user)
        today = timezone.localdate()

        by_status = dict(bugs.values_list('status').annotate(n=Count('id')))
        by_priority = dict(bugs.values_list('priority').annotate(n=Count('id')))
        total = sum(by_status.values())
        resolved = by_status.get('Resolved', 0)
        closed = by_status.get('Closed', 0)

        try:
            days = max(7, min(int(request.query_params.get('days', 14)), 90))
        except ValueError:
            days = 14
        start = today - timedelta(days=days - 1)

        created_per_day = dict(
            bugs.filter(created_at__date__gte=start).values_list('created_at__date').annotate(n=Count('id'))
        )
        resolved_per_day = dict(
            BugActivityLog.objects.filter(
                bug__in=bugs, action='Status Changed', new_value__in=['Resolved', 'Closed'], created_at__date__gte=start,
            ).values_list('created_at__date').annotate(n=Count('id'))
        )
        trend = []
        for i in range(days):
            day = start + timedelta(days=i)
            trend.append({
                'date': day.isoformat(),
                'name': day.strftime('%b %d'),
                'created': created_per_day.get(day, 0),
                'resolved': resolved_per_day.get(day, 0),
            })

        open_bugs = bugs.exclude(status__in=['Resolved', 'Closed'])
        return Response({
            'total': total,
            'status_breakdown': {
                'open': by_status.get('Open', 0),
                'in_progress': by_status.get('In Progress', 0),
                'resolved': resolved,
                'closed': closed,
            },
            'priority_breakdown': {
                'low': by_priority.get('Low', 0),
                'medium': by_priority.get('Medium', 0),
                'high': by_priority.get('High', 0),
                'critical': by_priority.get('Critical', 0),
            },
            'overdue': open_bugs.filter(due_date__lt=today).count(),
            'unassigned': open_bugs.filter(assigned_to__isnull=True).count(),
            'assigned_to_me': open_bugs.filter(assigned_to=request.user).count(),
            'trend': trend,
            'resolution_rate': round((resolved + closed) / total * 100, 1) if total else 0,
        })


class AttachmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                        mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        qs = Attachment.objects.filter(bug__in=visible_bugs(self.request.user)).select_related('uploaded_by', 'uploaded_by__profile')
        bug = self.request.query_params.get('bug')
        if bug:
            qs = qs.filter(bug_id=bug)
        return qs.order_by('-uploaded_at')

    def perform_create(self, serializer):
        attachment = serializer.save(uploaded_by=self.request.user)
        BugActivityLog.objects.create(
            bug=attachment.bug, actor=self.request.user, action="Attachment Added",
            old_value="", new_value=serializer.get_filename(attachment),
        )
        broadcast_bug_event(attachment.bug, 'updated')

    def perform_destroy(self, instance):
        user = self.request.user
        if not (can_manage(user) or instance.uploaded_by_id == user.id):
            raise PermissionDenied('Only the uploader or a manager can remove attachments.')
        bug = instance.bug
        instance.file.delete(save=False)
        instance.delete()
        broadcast_bug_event(bug, 'updated')


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (JSONParser, FormParser, MultiPartParser)

    def get_queryset(self):
        qs = Comment.objects.filter(bug__in=visible_bugs(self.request.user)).select_related('author', 'author__profile')
        bug = self.request.query_params.get('bug')
        if bug:
            qs = qs.filter(bug_id=bug)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        comment = serializer.save(author=user)
        bug = comment.bug

        recipients = {bug.created_by, bug.assigned_to}
        if comment.parent:
            recipients.add(comment.parent.author)
        snippet = comment.content if len(comment.content) <= 80 else comment.content[:77] + '...'
        for recipient in recipients - {None, user}:
            create_notification(
                recipient=recipient, actor=user, bug=bug,
                notification_type='Commented', title='New comment',
                message=f"{display_name(user)} commented on {bug.display_id}: {snippet}",
            )

        broadcast_bug_event(bug, 'updated')

    def _require_author(self, comment):
        user = self.request.user
        if comment.author_id != user.id and not is_admin(user):
            raise PermissionDenied('You can only change your own comments.')

    def perform_update(self, serializer):
        self._require_author(serializer.instance)
        serializer.save()
        broadcast_bug_event(serializer.instance.bug, 'updated')

    def perform_destroy(self, instance):
        self._require_author(instance)
        bug = instance.bug
        instance.delete()
        broadcast_bug_event(bug, 'updated')


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related('actor', 'actor__profile')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'status': 'notification marked as read'})

    @action(detail=False, methods=['post'])
    def read_all(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'all notifications marked as read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        return Response({'count': self.get_queryset().filter(is_read=False).count()})


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        org = get_org(self.request.user)
        if org is None:
            return Tag.objects.none()
        return Tag.objects.filter(organization=org).order_by('name')

    def _require_manager(self):
        if not can_manage(self.request.user):
            raise PermissionDenied('Only Admins and Managers can manage tags.')

    def perform_create(self, serializer):
        self._require_manager()
        serializer.save(organization=require_org(self.request.user))

    def perform_update(self, serializer):
        self._require_manager()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager()
        instance.delete()


class WorkLogViewSet(viewsets.ModelViewSet):
    serializer_class = WorkLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = WorkLog.objects.filter(bug__in=visible_bugs(self.request.user)).select_related('user', 'user__profile')
        bug = self.request.query_params.get('bug')
        if bug:
            qs = qs.filter(bug_id=bug)
        return qs

    def perform_create(self, serializer):
        log = serializer.save(user=self.request.user)
        broadcast_bug_event(log.bug, 'updated')

    def _require_owner(self, log):
        user = self.request.user
        if log.user_id != user.id and not is_admin(user):
            raise PermissionDenied('You can only change your own time entries.')

    def perform_update(self, serializer):
        self._require_owner(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_owner(instance)
        bug = instance.bug
        instance.delete()
        broadcast_bug_event(bug, 'updated')


class SavedFilterViewSet(viewsets.ModelViewSet):
    serializer_class = SavedFilterSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return SavedFilter.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
