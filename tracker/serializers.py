import os

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Bug, Attachment, Comment, Organization, OrganizationInvite, Notification,
    UserProfile, Project, BugActivityLog, Tag, WorkLog, SavedFilter
)
from .permissions import get_org, visible_bugs

MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024
BLOCKED_EXTENSIONS = {
    '.html', '.htm', '.xhtml', '.svg', '.js', '.mjs', '.exe', '.bat', '.cmd', '.com',
    '.msi', '.scr', '.sh', '.php', '.jar', '.vbs', '.ps1',
}


def _request_user(serializer):
    request = serializer.context.get('request')
    return getattr(request, 'user', None) if request else None


def _org_of(serializer):
    user = _request_user(serializer)
    return get_org(user) if user is not None and user.is_authenticated else None


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'domain', 'created_at']
        read_only_fields = ['id', 'domain', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Organization name cannot be blank.')
        return value


class OrganizationInviteSerializer(serializers.ModelSerializer):
    invited_by = serializers.StringRelatedField(read_only=True)
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = OrganizationInvite
        fields = ['id', 'organization', 'email', 'role', 'invited_by', 'accepted', 'created_at']
        read_only_fields = ['id', 'accepted', 'created_at']
        # (organization, email) uniqueness is handled in the view so that re-inviting updates the role.
        validators = []

    def validate_email(self, value):
        return value.strip().lower()


class UserProfileSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    position = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=100)
    working_on = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = UserProfile
        fields = ['role', 'status', 'position', 'working_on', 'organization']


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_superuser', 'profile']
        read_only_fields = ['id', 'username', 'is_superuser']

    def validate_email(self, value):
        value = value.strip().lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        instance = super().update(instance, validated_data)

        if profile_data:
            profile = getattr(instance, 'profile', None) or UserProfile.objects.create(user=instance)
            if 'position' in profile_data:
                profile.position = profile_data['position'] or ''
            if 'working_on' in profile_data:
                profile.working_on = profile_data['working_on'] or ''

            new_role = profile_data.get('role')
            if new_role and new_role != profile.role:
                # A sole Admin cannot demote themselves.
                if profile.role == 'Admin' and new_role != 'Admin':
                    other_admins = UserProfile.objects.filter(
                        organization=profile.organization,
                        role='Admin',
                        status='Active'
                    ).exclude(user=instance).exists()

                    if not other_admins:
                        raise serializers.ValidationError({
                            'profile': {'role': 'This is the only Admin in the organization. Assign another Admin before changing this role.'}
                        })
                profile.role = new_role

            if 'status' in profile_data:
                profile.status = profile_data['status']
            profile.save()

        return instance


class ProjectSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, source='members', write_only=True, required=False
    )
    bug_count = serializers.SerializerMethodField()
    open_bug_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'organization', 'name', 'description', 'prefix', 'created_by',
            'members', 'member_ids', 'bug_count', 'open_bug_count', 'created_at',
        ]
        read_only_fields = ['id', 'prefix', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Project name cannot be blank.')
        return value

    def validate_member_ids(self, members):
        org = _org_of(self)
        if org is None:
            return members
        for member in members:
            profile = getattr(member, 'profile', None)
            if not profile or profile.organization_id != org.id:
                raise serializers.ValidationError('All members must belong to your organization.')
        return members

    def get_bug_count(self, obj):
        annotated = getattr(obj, 'bug_total', None)
        return annotated if annotated is not None else obj.bugs.count()

    def get_open_bug_count(self, obj):
        annotated = getattr(obj, 'bug_open', None)
        if annotated is not None:
            return annotated
        return obj.bugs.filter(status__in=['Open', 'In Progress']).count()


class ProjectSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'prefix']


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    filename = serializers.SerializerMethodField()
    size = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ['id', 'bug', 'file', 'filename', 'size', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']

    def get_filename(self, obj):
        return os.path.basename(obj.file.name) if obj.file else ''

    def get_size(self, obj):
        try:
            return obj.file.size
        except (OSError, ValueError):
            return None

    def validate_bug(self, bug):
        user = _request_user(self)
        if user is not None and not visible_bugs(user).filter(pk=bug.pk).exists():
            raise serializers.ValidationError('Bug not found.')
        return bug

    def validate_file(self, f):
        if f.size > MAX_ATTACHMENT_BYTES:
            raise serializers.ValidationError('Files must be 100 MB or smaller.')
        ext = os.path.splitext(f.name)[1].lower()
        if ext in BLOCKED_EXTENSIONS:
            raise serializers.ValidationError(f'{ext} files are not allowed.')
        return f


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'bug', 'author', 'content', 'parent', 'replies', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_replies(self, obj):
        return CommentSerializer(obj.replies.all(), many=True, context=self.context).data

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError('Comment cannot be empty.')
        return value

    def validate(self, attrs):
        user = _request_user(self)
        bug = attrs.get('bug') or (self.instance.bug if self.instance else None)
        if user is not None and bug is not None and not visible_bugs(user).filter(pk=bug.pk).exists():
            raise serializers.ValidationError({'bug': 'Bug not found.'})
        if self.instance is not None and 'bug' in attrs and attrs['bug'] != self.instance.bug:
            raise serializers.ValidationError({'bug': 'A comment cannot be moved to another bug.'})
        parent = attrs.get('parent')
        if parent is not None and bug is not None and parent.bug_id != bug.pk:
            raise serializers.ValidationError({'parent': 'The parent comment belongs to a different bug.'})
        return attrs


class WorkLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = WorkLog
        fields = ['id', 'bug', 'user', 'hours', 'note', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_hours(self, value):
        if value <= 0:
            raise serializers.ValidationError('Hours must be greater than zero.')
        if value > 999:
            raise serializers.ValidationError('That is too many hours for a single entry.')
        return value

    def validate_bug(self, bug):
        user = _request_user(self)
        if user is not None and not visible_bugs(user).filter(pk=bug.pk).exists():
            raise serializers.ValidationError('Bug not found.')
        return bug


class SavedFilterSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedFilter
        fields = ['id', 'user', 'name', 'criteria', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class SimpleBugSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bug
        fields = ['id', 'display_id', 'title', 'status', 'priority']


class BugActivityLogSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = BugActivityLog
        fields = '__all__'


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'organization', 'name', 'color', 'created_at']
        read_only_fields = ['id', 'organization', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Tag name cannot be blank.')
        org = _org_of(self)
        if org is not None:
            qs = Tag.objects.filter(organization=org, name__iexact=value)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError('A tag with this name already exists.')
        return value

    def validate_color(self, value):
        import re
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', value or ''):
            raise serializers.ValidationError('Color must be a hex value like #3b82f6.')
        return value


class BugListSerializer(serializers.ModelSerializer):
    """Lightweight representation used by list endpoints."""
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    project_detail = ProjectSummarySerializer(source='project', read_only=True)
    tags_detail = TagSerializer(source='tags', many=True, read_only=True)
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = Bug
        fields = [
            'id', 'display_id', 'title', 'status', 'priority', 'due_date', 'project',
            'project_detail', 'created_by', 'assigned_to', 'tags_detail', 'comment_count',
            'created_at', 'updated_at',
        ]

    def get_comment_count(self, obj):
        annotated = getattr(obj, 'comment_total', None)
        return annotated if annotated is not None else obj.comments.count()


class BugSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='assigned_to', write_only=True, required=False, allow_null=True
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    project_detail = ProjectSummarySerializer(source='project', read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    activity_logs = BugActivityLogSerializer(many=True, read_only=True)
    tags_detail = TagSerializer(source='tags', many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), source='tags', many=True, write_only=True, required=False
    )
    linked_bugs_detail = SimpleBugSerializer(source='linked_bugs', many=True, read_only=True)
    linked_bug_ids = serializers.PrimaryKeyRelatedField(
        queryset=Bug.objects.all(), source='linked_bugs', many=True, write_only=True, required=False
    )
    work_logs = WorkLogSerializer(many=True, read_only=True)

    class Meta:
        model = Bug
        fields = '__all__'
        read_only_fields = ['id', 'display_id', 'organization', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
            creating = self.instance is None
            for key in ('project', 'due_date', 'assigned_to_id'):
                if key in data and data.get(key) in ('', None):
                    if creating:
                        data.pop(key)
                    else:
                        data[key] = None  # explicit clear on update (e.g. unassign)
            if 'steps_to_reproduce' in data and data.get('steps_to_reproduce') is None:
                data['steps_to_reproduce'] = ''
        return super().to_internal_value(data)

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Title cannot be blank.')
        return value

    def validate(self, attrs):
        org = _org_of(self)
        if org is None:
            return attrs

        assignee = attrs.get('assigned_to')
        if assignee is not None:
            profile = getattr(assignee, 'profile', None)
            if not profile or profile.organization_id != org.id or profile.status != 'Active':
                raise serializers.ValidationError({'assigned_to_id': 'Assignee must be an active member of your organization.'})

        project = attrs.get('project')
        if project is not None and project.organization_id != org.id:
            raise serializers.ValidationError({'project': 'Project not found.'})

        for tag in attrs.get('tags', []):
            if tag.organization_id != org.id:
                raise serializers.ValidationError({'tag_ids': 'Tag not found.'})

        for linked in attrs.get('linked_bugs', []):
            if linked.organization_id != org.id:
                raise serializers.ValidationError({'linked_bug_ids': 'Linked bug not found.'})
            if self.instance is not None and linked.pk == self.instance.pk:
                raise serializers.ValidationError({'linked_bug_ids': 'A bug cannot be linked to itself.'})
        return attrs

    def get_comments(self, obj):
        top_level = [c for c in obj.comments.all() if c.parent_id is None]
        top_level.sort(key=lambda c: c.created_at)
        return CommentSerializer(top_level, many=True, context=self.context).data


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'actor', 'bug', 'notification_type', 'title', 'message', 'is_read', 'created_at']
        read_only_fields = fields
