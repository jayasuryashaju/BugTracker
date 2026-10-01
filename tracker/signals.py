from django.core.mail import send_mail
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Bug


@receiver(pre_save, sender=Bug)
def remember_previous_assignee(sender, instance, **kwargs):
    if instance.pk:
        instance._previous_assignee_id = (
            Bug.objects.filter(pk=instance.pk).values_list('assigned_to_id', flat=True).first()
        )
    else:
        instance._previous_assignee_id = None


@receiver(post_save, sender=Bug)
def send_bug_assignment_email(sender, instance, created, **kwargs):
    """Email the assignee only when the assignment actually changes (not on every save)."""
    assignee = instance.assigned_to
    if not assignee or not assignee.email:
        return
    if not created and getattr(instance, '_previous_assignee_id', None) == assignee.id:
        return

    message = (
        "You have been assigned a bug.\n\n"
        f"ID: {instance.display_id}\n"
        f"Title: {instance.title}\n"
        f"Priority: {instance.priority}\n"
        f"Status: {instance.status}\n\n"
        "Open BugTracker Pro to see the full details."
    )
    send_mail(
        f"Bug assigned: {instance.display_id} {instance.title}",
        message,
        'noreply@bugtracker.com',
        [assignee.email],
        fail_silently=True,
    )
