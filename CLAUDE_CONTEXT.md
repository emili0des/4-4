# Claude Code Context File

## Project Goal
We are building a **.NET backend** to support an existing frontend project.
The backend specifications come from a `readme.md` file located in the frontend project.

## Workflow
- The developer is working across **two separate PCs** for security reasons.
- Backend development is being done manually in **Visual Studio** (not VS Code).
- A separate Claude instance (claude.ai) is guiding the developer step by step.
- This file exists to give Claude Code full context about the project.

## Your Role (Claude Code)
- Read the `readme.md` in this frontend project to understand the full requirements.
- Use it to understand what API endpoints, data models, and services the backend needs to expose.
- Help scaffold, generate, and organize the .NET backend project structure.
- Be detailed — the developer needs every small step explained clearly.

## Tech Stack
- **Frontend:** Existing project (refer to readme.md for details)
- **Backend:** .NET (C#) — Web API
- **IDE:** Visual Studio

## Instructions
1. Read the `readme.md` file in this project first.
2. Identify all frontend requirements that need backend support (API calls, authentication, data, etc.).
3. Propose a backend project structure.
4. Generate code step by step — controllers, models, services, DTOs, database context, configuration.
5. Do not skip any steps or assume the developer knows what to do next.
6. After each step, summarize what was done and what comes next.

## Notes
- The developer will manually copy and implement everything in Visual Studio on a separate machine.
- Keep explanations clear and beginner-friendly.
- If anything in the readme is ambiguous, ask for clarification before proceeding.
