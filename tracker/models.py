from django.db import models
from django.contrib.auth.models import User
import uuid

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.domain})"

class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name='projects', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    prefix = models.CharField(max_length=10, blank=True, null=True, unique=True)
    next_bug_sequence = models.IntegerField(default=1)
    created_by = models.ForeignKey(User, related_name='managed_projects', on_delete=models.CASCADE)
    members = models.ManyToManyField(User, related_name='assigned_projects', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.prefix:
            words = self.name.split()
            if len(words) == 1:
                base_prefix = words[0][:4].upper()
            else:
                base_prefix = "".join(word[0] for word in words[:4]).upper()
            
            base_prefix = "".join(c for c in base_prefix if c.isalnum())
            if not base_prefix:
                base_prefix = "PRJ"
                
            prefix = base_prefix
            counter = 1
            while Project.objects.filter(prefix=prefix).exclude(id=self.id).exists():
                prefix = f"{base_prefix}{counter}"
                counter += 1
            self.prefix = prefix
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

class OrganizationInvite(models.Model):
    ROLE_CHOICES = [
        ('Admin', 'Admin'),
        ('Manager', 'Manager'),
        ('Tester', 'Tester'),
        ('Developer', 'Developer'),
        ('User', 'User'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name='invites', on_delete=models.CASCADE)
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Developer')
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE)
    accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'email')

    def __str__(self):
        return f"Invite for {self.email} to {self.organization.name} as {self.role}"

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('Admin', 'Admin'),
        ('Manager', 'Manager'),
        ('Tester', 'Tester'),
        ('Developer', 'Developer'),
        ('User', 'User'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('PendingApproval', 'Pending Approval'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    organization = models.ForeignKey(Organization, related_name='members', on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Developer')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    position = models.CharField(max_length=100, blank=True, null=True, default='')
    working_on = models.TextField(blank=True, null=True, default='')

    def __str__(self):
        return f"{self.user.username}'s Profile ({self.role} - {self.status})"

class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name='tags', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=20, default="#3b82f6")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Bug(models.Model):
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved'),
        ('Closed', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    organization = models.ForeignKey(Organization, related_name='bugs', on_delete=models.CASCADE, null=True, blank=True)
    project = models.ForeignKey(Project, related_name='bugs', on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    steps_to_reproduce = models.TextField(blank=True, null=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    tags = models.ManyToManyField(Tag, related_name='bugs', blank=True)
    due_date = models.DateField(null=True, blank=True)
    linked_bugs = models.ManyToManyField('self', blank=True, symmetrical=False, related_name='linked_to')
    
    created_by = models.ForeignKey(User, related_name='created_bugs', on_delete=models.CASCADE)
    assigned_to = models.ForeignKey(User, related_name='assigned_bugs', on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        from django.db import transaction
        if not self.display_id:
            with transaction.atomic():
                if self.project:
                    # Use select_for_update to lock the project row to prevent race conditions
                    project = Project.objects.select_for_update().get(id=self.project.id)
                    self.display_id = f"{project.prefix}-{project.next_bug_sequence}"
                    project.next_bug_sequence += 1
                    project.save(update_fields=['next_bug_sequence'])
                else:
                    self.display_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.display_id}] {self.title} ({self.status})"

class Attachment(models.Model):
    bug = models.ForeignKey(Bug, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to='attachments/')
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment for {self.bug.title}"

class Comment(models.Model):
    bug = models.ForeignKey(Bug, related_name='comments', on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author.username} on {self.bug.title}"

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('Assigned', 'Bug Assigned'),
        ('StatusChanged', 'Status Updated'),
        ('Commented', 'New Comment'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(User, related_name='notifications', on_delete=models.CASCADE)
    actor = models.ForeignKey(User, related_name='triggered_notifications', on_delete=models.CASCADE)
    bug = models.ForeignKey(Bug, related_name='notifications', on_delete=models.CASCADE, null=True, blank=True)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title}"

class BugActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bug = models.ForeignKey(Bug, related_name='activity_logs', on_delete=models.CASCADE)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=100)
    old_value = models.CharField(max_length=255, blank=True, null=True)
    new_value = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor.username if self.actor else 'System'} - {self.action} on {self.bug.title}"

class WorkLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bug = models.ForeignKey(Bug, on_delete=models.CASCADE, related_name='work_logs')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='work_logs')
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.hours}h by {self.user.username} on {self.bug.title}"

class SavedFilter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_filters')
    name = models.CharField(max_length=100)
    criteria = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.user.username}"
