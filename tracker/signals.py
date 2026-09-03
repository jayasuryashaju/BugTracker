from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from .models import Bug

@receiver(post_save, sender=Bug)
def send_bug_assignment_email(sender, instance, created, **kwargs):
    if instance.assigned_to and instance.assigned_to.email:
        subject = f"Bug Assigned: {instance.title}"
        message = f"You have been assigned a bug.\n\nTitle: {instance.title}\nPriority: {instance.priority}\nStatus: {instance.status}\n\nPlease check the application for more details."
        send_mail(
            subject,
            message,
            'noreply@bugtracker.com',
            [instance.assigned_to.email],
            fail_silently=True,
        )
