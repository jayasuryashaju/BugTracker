from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    BugViewSet, AttachmentViewSet, CommentViewSet, UserViewSet,
    OrganizationInviteViewSet, NotificationViewSet, OrganizationViewSet, ProjectViewSet,
    TagViewSet, WorkLogViewSet, SavedFilterViewSet
)
from . import auth_views

router = DefaultRouter()
router.register(r'bugs', BugViewSet, basename='bug')
router.register(r'attachments', AttachmentViewSet, basename='attachment')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'users', UserViewSet, basename='user')
router.register(r'invites', OrganizationInviteViewSet, basename='invite')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'organization', OrganizationViewSet, basename='organization')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'worklogs', WorkLogViewSet, basename='worklog')
router.register(r'filters', SavedFilterViewSet, basename='filter')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', auth_views.login_view, name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', auth_views.register, name='register'),
    path('auth/microsoft/', auth_views.microsoft_login, name='microsoft_login'),
    path('auth/me/', auth_views.current_user, name='current_user'),
]
