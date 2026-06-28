**Src**
- **Top-level:** src/server.ts, src/test-app.ts, src/socket/index.ts
- **Config:** src/config/index.ts, src/config/database.ts, src/config/swagger.ts
- **Routes:** src/routes/index.ts, src/routes/auth.routes.ts, src/routes/ai.routes.ts, src/routes/admin.routes.ts, src/routes/appointment.routes.ts, src/routes/assessment.routes.ts, src/routes/chat.routes.ts, src/routes/message.routes.ts, src/routes/mood.routes.ts, src/routes/notification.routes.ts, src/routes/resource.routes.ts, src/routes/session.routes.ts, src/routes/therapist.routes.ts, src/routes/user.routes.ts
- **Controllers:** src/controllers/auth.controller.ts, src/controllers/ai.controller.ts, src/controllers/admin.controller.ts, src/controllers/assessment.controller.ts, src/controllers/chat.controller.ts, src/controllers/mood.controller.ts, src/controllers/resource.controller.ts, src/controllers/session.controller.ts, src/controllers/therapist.controller.ts, src/controllers/user.controller.ts
- **Models:** src/models/User.ts, src/models/Token.ts, src/models/TherapySession.ts, src/models/Therapist.ts, src/models/Assessment.ts, src/models/AssessmentResult.ts, src/models/Bookmark.ts, src/models/ChatMessage.ts, src/models/ChatSession.ts, src/models/MoodEntry.ts, src/models/Resource.ts
- **Services:** src/services/ai.service.ts, src/services/email.service.ts
- **Middleware:** src/middleware/auth.middleware.ts, src/middleware/error.middleware.ts, src/middleware/recaptcha.middleware.ts, src/middleware/upload.middleware.ts, src/middleware/validate.middleware.ts
- **Utils & types:** src/utils/logger.ts, src/utils/emailTemplates.ts, src/utils/ApiError.ts, src/types/index.ts, src/types/shims/swagger-jsdoc.d.ts, src/@types/swagger-jsdoc.d.ts

**Tests**
- **Setup & tests:** tests/setup.ts, tests/setup.js, tests/health.test.ts, tests/auth.test.ts, tests/auth.test.js

===FULL PROJECT TREE STRUCTURE===
backend/src
├── server.ts
├── test-app.ts
├── socket
│   └── index.ts
├── config
│   ├── database.ts
│   ├── index.ts
│   └── swagger.ts
├── routes
│   ├── index.ts
│   ├── auth.routes.ts
│   ├── ai.routes.ts
│   ├── admin.routes.ts
│   ├── appointment.routes.ts
│   ├── assessment.routes.ts
│   ├── chat.routes.ts
│   ├── message.routes.ts
│   ├── mood.routes.ts
│   ├── notification.routes.ts
│   ├── resource.routes.ts
│   ├── session.routes.ts
│   ├── therapist.routes.ts
│   └── user.routes.ts
├── controllers
│   ├── auth.controller.ts
│   ├── ai.controller.ts
│   ├── admin.controller.ts
│   ├── assessment.controller.ts
│   ├── chat.controller.ts
│   ├── mood.controller.ts
│   ├── resource.controller.ts
│   ├── session.controller.ts
│   ├── therapist.controller.ts
│   └── user.controller.ts
├── models
│   ├── User.ts
│   ├── Token.ts
│   ├── TherapySession.ts
│   ├── Therapist.ts
│   ├── Assessment.ts
│   ├── AssessmentResult.ts
│   ├── Bookmark.ts
│   ├── ChatMessage.ts
│   ├── ChatSession.ts
│   ├── MoodEntry.ts
│   └── Resource.ts
├── services
│   ├── ai.service.ts
│   └── email.service.ts
├── middleware
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   ├── recaptcha.middleware.ts
│   ├── upload.middleware.ts
│   └── validate.middleware.ts
├── utils
│   ├── logger.ts
│   ├── emailTemplates.ts
│   └── ApiError.ts
└── types
    ├── index.ts
    └── shims
        └── swagger-jsdoc.d.ts

backend/tests
├── setup.ts
├── setup.js
├── health.test.ts
├── auth.test.ts
└── auth.test.js