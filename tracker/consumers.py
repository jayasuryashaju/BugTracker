import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

@database_sync_to_async
def get_user_org_id(user):
    if hasattr(user, 'profile') and user.profile.organization:
        return user.profile.organization.id
    return None

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if self.user.is_anonymous:
            await self.close()
            return
            
        self.group_name = f'user_{self.user.id}'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        self.org_group_name = None
        org_id = await get_user_org_id(self.user)
        if org_id:
            self.org_group_name = f'org_{org_id}'
            await self.channel_layer.group_add(
                self.org_group_name,
                self.channel_name
            )

        await self.accept()

    async def disconnect(self, close_code):
        if not getattr(self, 'user', None) or self.user.is_anonymous:
            return
            
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

        if getattr(self, 'org_group_name', None):
            await self.channel_layer.group_discard(
                self.org_group_name,
                self.channel_name
            )

    # Receive message from room group
    async def send_notification(self, event):
        notification = event['notification']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': notification
        }))

    async def send_bug_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'bug_event',
            'data': event['data']
        }))
