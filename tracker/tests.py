from datetime import timedelta

from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Attachment, Bug, Comment, Notification, Organization, OrganizationInvite,
    Project, Tag, UserProfile, WorkLog,
)


def results(response):
    return response.data.get('results', response.data)


def make_user(username, org, role='Developer', **extra):
    user = User.objects.create_user(username=username, password='password', email=f'{username}@example.com', **extra)
    UserProfile.objects.create(user=user, organization=org, role=role)
    return user


class BaseTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.org1 = Organization.objects.create(name="Org 1", domain="org1.com")
        self.admin1 = make_user('admin1', self.org1, 'Admin')
        self.manager1 = make_user('manager1', self.org1, 'Manager')
        self.tester1 = make_user('tester1', self.org1, 'Tester')
        self.dev1 = make_user('dev1', self.org1, 'Developer')
        self.dev1b = make_user('dev1b', self.org1, 'Developer')
        self.project1 = Project.objects.create(name="Project 1", organization=self.org1, created_by=self.admin1)
        self.project1.members.add(self.dev1)
        self.bug1 = Bug.objects.create(
            title="Bug 1", description="d", organization=self.org1, project=self.project1,
            created_by=self.tester1, assigned_to=self.dev1,
        )

        self.org2 = Organization.objects.create(name="Org 2", domain="org2.com")
        self.admin2 = make_user('admin2', self.org2, 'Admin')
        self.project2 = Project.objects.create(name="Project 2", organization=self.org2, created_by=self.admin2)
        self.bug2 = Bug.objects.create(title="Bug 2", description="d", organization=self.org2, project=self.project2, created_by=self.admin2)
        self.tag2 = Tag.objects.create(organization=self.org2, name='secret')

    def as_user(self, user):
        self.client.force_authenticate(user=user)


class ScopedQuerysetTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.comment1 = Comment.objects.create(bug=self.bug1, author=self.tester1, content="Comment 1")
        self.comment2 = Comment.objects.create(bug=self.bug2, author=self.admin2, content="Comment 2")
        self.attachment1 = Attachment.objects.create(
            bug=self.bug1, uploaded_by=self.tester1, file=SimpleUploadedFile("file1.txt", b"x"))
        self.attachment2 = Attachment.objects.create(
            bug=self.bug2, uploaded_by=self.admin2, file=SimpleUploadedFile("file2.txt", b"x"))

    def test_comment_queryset_scoped_to_organization(self):
        self.as_user(self.admin1)
        response = self.client.get('/api/comments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([c['id'] for c in results(response)], [self.comment1.id])

    def test_attachment_queryset_scoped_to_organization(self):
        self.as_user(self.admin1)
        response = self.client.get('/api/attachments/')
        self.assertEqual([a['id'] for a in results(response)], [self.attachment1.id])

    def test_other_org_bug_is_404(self):
        self.as_user(self.admin1)
        self.assertEqual(self.client.get(f'/api/bugs/{self.bug2.id}/').status_code, 404)

    def test_other_org_user_hidden(self):
        self.as_user(self.admin1)
        ids = [u['id'] for u in results(self.client.get('/api/users/'))]
        self.assertNotIn(self.admin2.id, ids)

    def test_developer_sees_assigned_and_own_bugs_only(self):
        self.as_user(self.dev1)
        self.assertEqual([b['id'] for b in results(self.client.get('/api/bugs/'))], [str(self.bug1.id)])
        self.as_user(self.dev1b)
        self.assertEqual(results(self.client.get('/api/bugs/')), [])
        created = self.client.post('/api/bugs/', {'title': 'Mine', 'description': 'x'}, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(len(results(self.client.get('/api/bugs/'))), 1)


class CrossTenantWriteTests(BaseTestCase):
    def test_cannot_assign_bug_to_other_org_user(self):
        self.as_user(self.admin1)
        r = self.client.patch(f'/api/bugs/{self.bug1.id}/', {'assigned_to_id': self.admin2.id}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cannot_use_other_org_project_or_tag(self):
        self.as_user(self.admin1)
        r = self.client.post('/api/bugs/', {'title': 't', 'description': 'd', 'project': str(self.project2.id)}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/bugs/', {'title': 't', 'description': 'd', 'tag_ids': [str(self.tag2.id)]}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cannot_comment_on_other_org_bug(self):
        self.as_user(self.admin1)
        r = self.client.post('/api/comments/', {'bug': str(self.bug2.id), 'content': 'hi'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cannot_log_work_or_upload_to_other_org_bug(self):
        self.as_user(self.admin1)
        r = self.client.post('/api/worklogs/', {'bug': str(self.bug2.id), 'hours': '1'}, format='json')
        self.assertEqual(r.status_code, 400)
        f = SimpleUploadedFile('a.txt', b'x')
        r = self.client.post('/api/attachments/', {'bug': str(self.bug2.id), 'file': f}, format='multipart')
        self.assertEqual(r.status_code, 400)

    def test_organization_cannot_be_changed_via_bug_patch(self):
        self.as_user(self.admin1)
        self.client.patch(f'/api/bugs/{self.bug1.id}/', {'organization': str(self.org2.id)}, format='json')
        self.bug1.refresh_from_db()
        self.assertEqual(self.bug1.organization_id, self.org1.id)

    def test_project_members_must_be_in_org(self):
        self.as_user(self.admin1)
        r = self.client.post('/api/projects/', {'name': 'X', 'member_ids': [self.admin2.id]}, format='json')
        self.assertEqual(r.status_code, 400)


class UserPermissionTests(BaseTestCase):
    def test_member_cannot_edit_other_user(self):
        self.as_user(self.dev1)
        r = self.client.patch(f'/api/users/{self.dev1b.id}/', {'first_name': 'Hacked'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_member_cannot_promote_self(self):
        self.as_user(self.dev1)
        r = self.client.patch(f'/api/users/{self.dev1.id}/', {'profile': {'role': 'Admin'}}, format='json')
        self.assertEqual(r.status_code, 403)
        self.dev1.profile.refresh_from_db()
        self.assertEqual(self.dev1.profile.role, 'Developer')

    def test_member_can_edit_own_profile(self):
        self.as_user(self.dev1)
        r = self.client.put(
            f'/api/users/{self.dev1.id}/',
            {'first_name': 'Dee', 'profile': {'position': 'Engineer', 'role': 'Developer'}}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['first_name'], 'Dee')
        self.assertEqual(r.data['profile']['position'], 'Engineer')

    def test_admin_can_change_role_but_not_sole_admin_self_demote(self):
        self.as_user(self.admin1)
        r = self.client.patch(f'/api/users/{self.dev1.id}/', {'profile': {'role': 'Tester'}}, format='json')
        self.assertEqual(r.status_code, 200)
        r = self.client.patch(f'/api/users/{self.admin1.id}/', {'profile': {'role': 'Developer'}}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_only_admin_edits_organization(self):
        self.as_user(self.manager1)
        self.assertEqual(self.client.patch('/api/organization/current/', {'name': 'Nope'}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/organization/{self.org1.id}/', {'name': 'Nope'}, format='json').status_code, 405)
        self.as_user(self.admin1)
        r = self.client.patch('/api/organization/current/', {'name': 'Renamed', 'domain': 'evil.com'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.org1.refresh_from_db()
        self.assertEqual((self.org1.name, self.org1.domain), ('Renamed', 'org1.com'))


class ProjectAndTagPermissionTests(BaseTestCase):
    def test_only_managers_manage_projects(self):
        self.as_user(self.tester1)
        self.assertEqual(self.client.post('/api/projects/', {'name': 'New'}, format='json').status_code, 403)
        self.as_user(self.manager1)
        self.assertEqual(self.client.post('/api/projects/', {'name': 'New'}, format='json').status_code, 201)

    def test_member_cannot_edit_or_delete_project(self):
        self.as_user(self.dev1)
        self.assertEqual(self.client.patch(f'/api/projects/{self.project1.id}/', {'name': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/projects/{self.project1.id}/').status_code, 403)

    def test_developer_only_sees_member_projects(self):
        self.as_user(self.dev1b)
        self.assertEqual(results(self.client.get('/api/projects/')), [])
        self.as_user(self.dev1)
        self.assertEqual(len(results(self.client.get('/api/projects/'))), 1)

    def test_project_counts(self):
        self.as_user(self.admin1)
        data = results(self.client.get('/api/projects/'))[0]
        self.assertEqual((data['bug_count'], data['open_bug_count'], data['prefix']), (1, 1, 'P1'))

    def test_tags_admin_manager_only_and_unique(self):
        self.as_user(self.tester1)
        self.assertEqual(self.client.post('/api/tags/', {'name': 'ui', 'color': '#112233'}, format='json').status_code, 403)
        self.as_user(self.manager1)
        self.assertEqual(self.client.post('/api/tags/', {'name': 'ui', 'color': '#112233'}, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/tags/', {'name': 'UI', 'color': '#112233'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/tags/', {'name': 'bad', 'color': 'red'}, format='json').status_code, 400)


class InviteTests(BaseTestCase):
    def test_invite_flow(self):
        self.as_user(self.manager1)
        r = self.client.post('/api/invites/', {'email': 'New@Example.com', 'role': 'Tester'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['email'], 'new@example.com')
        r = self.client.post('/api/invites/', {'email': 'new@example.com', 'role': 'Developer'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['role'], 'Developer')
        self.assertEqual(OrganizationInvite.objects.count(), 1)

        self.client.force_authenticate(user=None)
        r = self.client.post('/api/auth/register/', {'email': 'new@example.com', 'password': 'Sup3r-secret-pw'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        profile = User.objects.get(email='new@example.com').profile
        self.assertEqual((profile.organization_id, profile.role), (self.org1.id, 'Developer'))

    def test_existing_member_and_permissions(self):
        self.as_user(self.manager1)
        r = self.client.post('/api/invites/', {'email': self.dev1.email, 'role': 'Developer'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/invites/', {'email': 'a@b.co', 'role': 'Admin'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.as_user(self.dev1)
        r = self.client.post('/api/invites/', {'email': 'a@b.co', 'role': 'Developer'}, format='json')
        self.assertEqual(r.status_code, 403)


class BugBehaviourTests(BaseTestCase):
    def test_unassign_and_clear_due_date(self):
        self.bug1.due_date = timezone.localdate()
        self.bug1.save()
        self.as_user(self.manager1)
        r = self.client.patch(f'/api/bugs/{self.bug1.id}/', {'assigned_to_id': None, 'due_date': None}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.bug1.refresh_from_db()
        self.assertIsNone(self.bug1.assigned_to)
        self.assertIsNone(self.bug1.due_date)

    def test_priority_ordering_is_by_severity(self):
        for p in ('Low', 'Critical', 'High'):
            Bug.objects.create(title=p, description='d', priority=p, organization=self.org1, created_by=self.admin1)
        self.as_user(self.admin1)
        order = [b['priority'] for b in results(self.client.get('/api/bugs/?ordering=-priority_rank'))]
        self.assertEqual(order, ['Critical', 'High', 'Medium', 'Low'])

    def test_filters(self):
        Bug.objects.create(title='Late', description='d', organization=self.org1, created_by=self.admin1,
                           due_date=timezone.localdate() - timedelta(days=2))
        Bug.objects.create(title='Done late', description='d', status='Closed', organization=self.org1,
                           created_by=self.admin1, due_date=timezone.localdate() - timedelta(days=2))
        self.as_user(self.admin1)
        self.assertEqual([b['title'] for b in results(self.client.get('/api/bugs/?overdue=true'))], ['Late'])
        self.assertEqual(len(results(self.client.get('/api/bugs/?unassigned=true'))), 2)
        self.assertEqual(len(results(self.client.get(f'/api/bugs/?mine=true'))), 0)
        self.assertEqual(len(results(self.client.get('/api/bugs/?search=BUG-1'))), 0)
        self.assertEqual(len(results(self.client.get(f'/api/bugs/?search={self.bug1.display_id}'))), 1)

    def test_activity_notifications_and_single_email(self):
        self.as_user(self.manager1)
        mail.outbox.clear()
        self.client.patch(f'/api/bugs/{self.bug1.id}/', {'status': 'In Progress'}, format='json')
        self.client.patch(f'/api/bugs/{self.bug1.id}/', {'priority': 'High'}, format='json')
        self.assertEqual(len(mail.outbox), 0, 'updates that do not change the assignee must not send email')
        self.client.patch(f'/api/bugs/{self.bug1.id}/', {'assigned_to_id': self.dev1b.id}, format='json')
        self.assertEqual(len(mail.outbox), 1)
        detail = self.client.get(f'/api/bugs/{self.bug1.id}/').data
        actions = [log['action'] for log in detail['activity_logs']]
        for expected in ('Status Changed', 'Priority Changed', 'Assignee Changed'):
            self.assertIn(expected, actions)
        # created_by (tester1) and the previous assignee (dev1) are told about the status change
        recipients = set(Notification.objects.filter(notification_type='StatusChanged').values_list('recipient__username', flat=True))
        self.assertEqual(recipients, {'tester1', 'dev1'})

    def test_delete_permissions(self):
        self.as_user(self.dev1)
        self.assertEqual(self.client.delete(f'/api/bugs/{self.bug1.id}/').status_code, 403)
        self.as_user(self.manager1)
        self.assertEqual(self.client.delete(f'/api/bugs/{self.bug1.id}/').status_code, 204)

    def test_unrelated_developer_cannot_edit(self):
        self.as_user(self.dev1b)
        self.assertEqual(self.client.patch(f'/api/bugs/{self.bug1.id}/', {'title': 'x'}, format='json').status_code, 404)

    def test_analytics(self):
        self.as_user(self.admin1)
        data = self.client.get('/api/bugs/analytics/').data
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['status_breakdown']['open'], 1)
        self.assertEqual(len(data['trend']), 14)
        self.assertEqual(sum(d['created'] for d in data['trend']), 1)
        self.assertEqual(data['assigned_to_me'], 0)

    def test_broadcast_payload_contains_only_the_id(self):
        from .views import broadcast_bug_event
        from unittest import mock
        with mock.patch('tracker.views._send_to_group') as send:
            broadcast_bug_event(self.bug1, 'updated')
        self.assertEqual(send.call_args[0][1]['data'], {'action': 'updated', 'bug': {'id': str(self.bug1.id)}})


class CommentWorkLogAttachmentTests(BaseTestCase):
    def test_comment_rules(self):
        self.as_user(self.dev1)
        r = self.client.post('/api/comments/', {'bug': str(self.bug1.id), 'content': 'On it'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        cid = r.data['id']
        self.assertEqual(self.client.post('/api/comments/', {'bug': str(self.bug1.id), 'content': '  '}, format='json').status_code, 400)
        self.assertTrue(Notification.objects.filter(recipient=self.tester1, notification_type='Commented').exists())
        self.as_user(self.tester1)
        self.assertEqual(self.client.patch(f'/api/comments/{cid}/', {'content': 'edit'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/comments/{cid}/').status_code, 403)
        self.as_user(self.dev1)
        self.assertEqual(self.client.patch(f'/api/comments/{cid}/', {'content': 'edit'}, format='json').status_code, 200)
        self.assertEqual(self.client.delete(f'/api/comments/{cid}/').status_code, 204)

    def test_reply_parent_must_be_same_bug(self):
        other = Bug.objects.create(title='o', description='d', organization=self.org1, created_by=self.admin1)
        parent = Comment.objects.create(bug=other, author=self.admin1, content='p')
        self.as_user(self.admin1)
        r = self.client.post('/api/comments/', {'bug': str(self.bug1.id), 'content': 'x', 'parent': parent.id}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_worklog_rules(self):
        self.as_user(self.dev1)
        self.assertEqual(self.client.post('/api/worklogs/', {'bug': str(self.bug1.id), 'hours': '0'}, format='json').status_code, 400)
        r = self.client.post('/api/worklogs/', {'bug': str(self.bug1.id), 'hours': '1.5', 'note': 'n'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.as_user(self.tester1)
        self.assertEqual(self.client.delete(f'/api/worklogs/{r.data["id"]}/').status_code, 403)
        self.as_user(self.dev1)
        self.assertEqual(self.client.delete(f'/api/worklogs/{r.data["id"]}/').status_code, 204)
        self.assertEqual(WorkLog.objects.count(), 0)

    def test_attachment_validation(self):
        self.as_user(self.dev1)
        bad = SimpleUploadedFile('x.html', b'<script>1</script>')
        r = self.client.post('/api/attachments/', {'bug': str(self.bug1.id), 'file': bad}, format='multipart')
        self.assertEqual(r.status_code, 400)
        good = SimpleUploadedFile('shot.png', b'png')
        r = self.client.post('/api/attachments/', {'bug': str(self.bug1.id), 'file': good}, format='multipart')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['filename'].split('.')[-1], 'png')
        self.as_user(self.tester1)  # reporter but not uploader and not a manager
        self.assertEqual(self.client.delete(f'/api/attachments/{r.data["id"]}/').status_code, 403)


class NotificationTests(BaseTestCase):
    def test_mark_read_and_scoping(self):
        n = Notification.objects.create(recipient=self.dev1, actor=self.admin1, bug=self.bug1,
                                        notification_type='Assigned', title='t', message='m')
        self.as_user(self.dev1b)
        self.assertEqual(self.client.post(f'/api/notifications/{n.id}/mark_read/').status_code, 404)
        self.as_user(self.dev1)
        self.assertEqual(self.client.get('/api/notifications/unread_count/').data['count'], 1)
        self.assertEqual(self.client.post(f'/api/notifications/{n.id}/mark_read/').status_code, 200)
        self.assertEqual(self.client.get('/api/notifications/unread_count/').data['count'], 0)
        self.assertEqual(self.client.post(f'/api/notifications/{n.id}/mark_read/').status_code, 200)


class AuthTests(APITestCase):
    def setUp(self):
        cache.clear()

    def register(self, email, password='Sup3r-secret-pw', **extra):
        return self.client.post('/api/auth/register/', {'email': email, 'password': password, **extra}, format='json')

    def test_first_company_user_becomes_admin_second_is_blocked(self):
        r = self.register('ann@acme.io', first_name='Ann')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data['is_new_org'])
        self.assertEqual(User.objects.get(email='ann@acme.io').profile.role, 'Admin')
        r = self.register('bob@acme.io')
        self.assertEqual(r.status_code, 403)
        self.assertFalse(User.objects.filter(email='bob@acme.io').exists())

    def test_free_mail_users_each_get_their_own_workspace(self):
        self.assertEqual(self.register('a@gmail.com').status_code, 200)
        self.assertEqual(self.register('b@gmail.com').status_code, 200)
        a = User.objects.get(email='a@gmail.com').profile
        b = User.objects.get(email='b@gmail.com').profile
        self.assertNotEqual(a.organization_id, b.organization_id)
        self.assertEqual((a.role, b.role), ('Admin', 'Admin'))

    def test_register_validation(self):
        self.assertEqual(self.register('not-an-email').status_code, 400)
        self.assertEqual(self.register('x@acme.io', password='123').status_code, 400)
        self.assertEqual(self.register('y@gmail.com').status_code, 200)
        self.assertEqual(self.register('Y@gmail.com').status_code, 400)

    def test_login_by_email_or_username_and_inactive(self):
        self.register('carl@gmail.com')
        for ident in ('carl@gmail.com', 'CARL@gmail.com', 'carl'):
            r = self.client.post('/api/auth/login/', {'username': ident, 'password': 'Sup3r-secret-pw'}, format='json')
            self.assertEqual(r.status_code, 200, ident)
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'carl', 'password': 'wrong'}, format='json').status_code, 401)
        User.objects.filter(username='carl').update(is_active=False)
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'carl', 'password': 'Sup3r-secret-pw'}, format='json').status_code, 401)

    def test_me_requires_auth_and_returns_profile(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        token = self.register('dee@gmail.com').data['access']
        r = self.client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(r.data['profile']['role'], 'Admin')
        self.assertEqual(r.data['email'], 'dee@gmail.com')

    def test_login_is_throttled(self):
        statuses = [
            self.client.post('/api/auth/login/', {'username': 'x', 'password': 'y'}, format='json').status_code
            for _ in range(35)
        ]
        self.assertIn(429, statuses)
