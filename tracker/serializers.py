from rest_framework import serializers
from .models import (
    Bug, Attachment, Comment, Organization, OrganizationInvite, Notification, 
    UserProfile, Project, BugActivityLog, Tag, WorkLog, SavedFilter
)
from django.contrib.auth.models import User

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'domain', 'created_at']

class OrganizationInviteSerializer(serializers.ModelSerializer):
    invited_by = serializers.StringRelatedField(read_only=True)
    organization = OrganizationSerializer(read_only=True)
    class Meta:
        model = OrganizationInvite
        fields = ['id', 'organization', 'email', 'role', 'invited_by', 'accepted', 'created_at']

class UserProfileSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    class Meta:
        model = UserProfile
        fields = ['role', 'status', 'position', 'working_on', 'organization']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        instance = super().update(instance, validated_data)
        
        if profile_data:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            profile.position = profile_data.get('position', profile.position)
            profile.working_on = profile_data.get('working_on', profile.working_on)
            
            new_role = profile_data.get('role')
            if new_role and new_role != profile.role:
                # Demotion safeguard:Sole admin cannot demote themselves without promoting another admin first
                if profile.role == 'Admin' and new_role != 'Admin':
                    other_admins = UserProfile.objects.filter(
                        organization=profile.organization,
                        role='Admin',
                        status='Active'
                    ).exclude(user=instance).exists()
                    
                    if not other_admins:
                        raise serializers.ValidationError({
                            'profile': {'role': 'You are the only Admin in your organization. Please assign another Admin before changing your role.'}
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

    class Meta:
        model = Project
        fields = ['id', 'organization', 'name', 'description', 'created_by', 'members', 'member_ids', 'bug_count', 'created_at']

    def get_bug_count(self, obj):
        return obj.bugs.count()

class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    class Meta:
        model = Attachment
        fields = '__all__'

class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = '__all__'

    def get_replies(self, obj):
        if obj.replies.exists():
            return CommentSerializer(obj.replies.all(), many=True).data
        return []

class WorkLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = WorkLog
        fields = '__all__'

class SavedFilterSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedFilter
        fields = '__all__'
        read_only_fields = ['user']

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
        fields = '__all__'
        read_only_fields = ['organization']

class BugSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='assigned_to', write_only=True, required=False, allow_null=True
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    project_detail = ProjectSerializer(source='project', read_only=True)
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

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            if data.get('project') == '' or data.get('project') is None:
                data.pop('project', None)
            if data.get('due_date') == '' or data.get('due_date') is None:
                data.pop('due_date', None)
            if data.get('assigned_to_id') == '' or data.get('assigned_to_id') is None:
                data.pop('assigned_to_id', None)
            if data.get('steps_to_reproduce') is None:
                data['steps_to_reproduce'] = ''
        return super().to_internal_value(data)
        
    def get_comments(self, obj):
        top_level_comments = obj.comments.filter(parent__isnull=True)
        return CommentSerializer(top_level_comments, many=True).data

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'actor', 'bug', 'notification_type', 'title', 'message', 'is_read', 'created_at']
