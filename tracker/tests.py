from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from .models import Organization, UserProfile, Project, Bug, Comment, Attachment
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

class ScopedQuerysetTests(APITestCase):
    def setUp(self):
        # Create Org 1
        self.org1 = Organization.objects.create(name="Org 1", domain="org1.com")
        self.user1 = User.objects.create_user(username="user1", password="password")
        UserProfile.objects.create(user=self.user1, organization=self.org1, role="Admin")
        self.project1 = Project.objects.create(name="Project 1", organization=self.org1, created_by=self.user1)
        self.bug1 = Bug.objects.create(title="Bug 1", organization=self.org1, project=self.project1, created_by=self.user1)
        self.comment1 = Comment.objects.create(bug=self.bug1, author=self.user1, content="Comment 1")
        
        file1 = SimpleUploadedFile("file1.txt", b"file_content", content_type="text/plain")
        self.attachment1 = Attachment.objects.create(bug=self.bug1, uploaded_by=self.user1, file=file1)

        # Create Org 2
        self.org2 = Organization.objects.create(name="Org 2", domain="org2.com")
        self.user2 = User.objects.create_user(username="user2", password="password")
        UserProfile.objects.create(user=self.user2, organization=self.org2, role="Admin")
        self.project2 = Project.objects.create(name="Project 2", organization=self.org2, created_by=self.user2)
        self.bug2 = Bug.objects.create(title="Bug 2", organization=self.org2, project=self.project2, created_by=self.user2)
        self.comment2 = Comment.objects.create(bug=self.bug2, author=self.user2, content="Comment 2")
        
        file2 = SimpleUploadedFile("file2.txt", b"file_content", content_type="text/plain")
        self.attachment2 = Attachment.objects.create(bug=self.bug2, uploaded_by=self.user2, file=file2)

    def test_comment_queryset_scoped_to_organization(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/comments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.comment1.id)

    def test_attachment_queryset_scoped_to_organization(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/attachments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.attachment1.id)
