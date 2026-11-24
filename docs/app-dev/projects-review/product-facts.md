# Projects comparison — verified product facts

Checked 2026-11-23, America/New_York. Primary official documentation only. This records research for the Entomate Projects audit; recommendations are separated from product claims.

## Fellow

- Current documented primary navigation centers on Calendar, Library and Action items. Library channels organize recorded/shared meeting content. Action items can also be created without an associated meeting.
  - https://help.fellow.ai/en/articles/12996027-welcome-to-the-new-fellow
- Recording channels organize recaps/recordings/clips with membership and visibility controls. Publishing recap content does not automatically share the meeting's note content. Series-level automation can publish future recaps.
  - https://help.fellow.ai/en/articles/9518898-recording-channels
- The Action Item page supports source/due information, assignment, editing dates, custom grouping (including a project grouping), sorting, completion and linked copies. Linked copies share completion and appear once in the action-item list; independent copies are separate.
  - https://help.fellow.ai/en/articles/4144380-action-item-page
- AI-suggested items can be accepted/dismissed. Accepted items enter inbox/sync/carry-forward; auto-accept is a user choice. This is evidence for a review boundary, not a requirement to copy Fellow's dismissal/deletion policy.
  - https://help.fellow.ai/en/articles/17299858-ai-suggested-action-items
- Ask Fellow can focus on a channel or filtered meetings, answer across recordings/transcripts/notes and draft documents.
  - https://help.fellow.ai/en/articles/9077100-ask-fellow-your-ai-powered-meeting-assistant
- Optional Asana integration supports individual item linking and meeting-series-to-project linking. Its documented bidirectional sync includes task names, due dates and completion. Connection scope and destination settings are explicit.
  - https://help.fellow.ai/en/articles/4337652-asana-integration

Inference: Fellow's published model is a meeting-context and follow-through workspace with optional deeper execution-tool connections. These pages do not establish that Fellow has no other native project features, and no Fellow account was exercised here.

## Asana

- Project overview documents description, project roles, resources, a maintained brief, milestones, and progress/status updates.
  - https://help.asana.com/s/article/project-overview-tab?language=en_US
- Status updates document current health, achievements, blockers and next steps; members receive inbox notification when an update is posted.
  - https://help.asana.com/s/article/share-project-updates

Inference: a brief, ownership, milestones and updates are useful completeness checks for Entomate. Reproducing Asana's whole feature set is unnecessary.

## Entomate source facts

- Reviewed commit `cef0718a321810e671b539a3434ab08f87b460d4`; matched remote main during the audit.
- Project page uses native projects/tasks/meetings/action_items records and existing source adapters.
- Ento AI already proposes/executes confirmed project-and-task batches; personal conversation/history and action logs are separate records.
- Neither a source review nor a repository migration establishes current production deployment or schema state. No live end-to-end verification was performed.
- User's supplied screenshot and release-checkout Bench/Swiss TSX/CSS are the design context. No fabricated competitor UI or new production mockup was generated.
