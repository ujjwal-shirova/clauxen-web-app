# Frontend reference

## Providers (order matters)

Auth → AppPreferences → ChatSession (`useChatApi`) → Overlays → Artifact → Follow-up → Notifications → Shell → OverlayHost portal.

## ChatSessionProvider

API-only (`useChatApi`). Keep guest `useChat` IndexedDB path out of main signed-in bundle.
