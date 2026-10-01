"""Shared role / organization helpers used by views and serializers."""
from django.db.models import Q

MANAGE_ROLES = ('Admin', 'Manager')

FREE_MAIL_DOMAINS = {
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me',
    'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com',
}


def get_profile(user):
    return getattr(user, 'profile', None)


def get_org(user):
    profile = get_profile(user)
    return profile.organization if profile else None


def get_role(user):
    profile = get_profile(user)
    return profile.role if profile else None


def is_admin(user):
    return bool(user.is_superuser or get_role(user) == 'Admin')


def can_manage(user):
    """Admins and Managers manage projects, people and tags."""
    return bool(user.is_superuser or get_role(user) in MANAGE_ROLES)


def visible_bugs(user):
    """Bugs the user is allowed to see. Developers only see bugs they own or filed."""
    from .models import Bug

    org = get_org(user)
    if org is None:
        return Bug.objects.none()
    qs = Bug.objects.filter(organization=org)
    if get_role(user) == 'Developer' and not user.is_superuser:
        qs = qs.filter(Q(assigned_to=user) | Q(created_by=user))
    return qs
