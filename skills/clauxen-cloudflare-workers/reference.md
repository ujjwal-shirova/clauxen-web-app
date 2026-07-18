# Workers reference

## chat-history API

GET `/v1/chats`, GET `/v1/chats/:id/messages` (Bearer JWT)  
POST `/internal/warm|invalidate` (`x-clauxen-internal`)  
Header: `x-clauxen-cache: …`

## chat-coord API

POST `/lease|release|stop|status` with internal token.
