from django.contrib import admin
from .models import Bug, Attachment, Comment

admin.site.register(Bug)
admin.site.register(Attachment)
admin.site.register(Comment)
