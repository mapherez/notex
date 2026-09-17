# NoteX Developer Documentation

These documents describe internal architecture and future engineering work.
They are not end-user guides.

## Application

- [Architecture constraints](ARCHITECTURE_CONSTRAINTS.md)
- [Data model](DATA_MODEL.md)
- [Layout](LAYOUT.md)
- [Responsive implementation plan](RESPONSIVE_IMPLEMENTATION_PLAN.md)
- [Local MCP feature parity plan](MCP_LOCAL_FEATURE_PARITY_PLAN.md)
- [Pages](PAGES.md)
- [Routes](ROUTES.md)
- [Stack](STACK.md)

## Google Drive and browser mode

- [Implementation plan](GOOGLE_DRIVE_WEB_IMPLEMENTATION_PLAN.md)
- [Google OAuth and build configuration](GOOGLE_DRIVE_SETUP.md)
- [Web deployment and release preparation](GOOGLE_DRIVE_WEB_DEPLOYMENT.md)
- [Validation and remaining release work](GOOGLE_DRIVE_WEB_CHECKPOINT.md)

## Future Remote MCP

The embedded local MCP server is the active, completed integration. The
documents below preserve the separate hosted bridge design for future access
from AI platforms that cannot connect to a local loopback server.

- [Remote architecture](MCP_REMOTE_ARCHITECTURE.md)
- [Backend operations](MCP_REMOTE_BACKEND_OPERATIONS.md)
- [Remote implementation plan](MCP_REMOTE_IMPLEMENTATION_PLAN.md)
