# Storage Layer Implementation Guide

## Overview

The Storage Layer (`utils/storage.py`) provides a JSON-based file storage system for the chatbot application. It handles persistent storage of conversations, escalations, and provides automatic cleanup of old sessions. The module is designed with separation of concerns, error handling, and logging to ensure reliable data persistence.

**Key Features:**
- **Conversations**: Save, load, list, and delete chat history by session ID
- **Escalations**: Store escalation requests with user details and priority levels
- **Auto-cleanup**: Remove old sessions after configurable timeout (default: 24 hours)
- **Error Handling**: Comprehensive error handling for storage operations
- **Logging**: Integrated logging for debugging and monitoring

## Architecture

### Components

1. **`utils/storage.py`**: Core storage module with all data access functions
2. **`app.py`**: Flask application that imports and uses storage functions
3. **`data/`**: Directory structure for storing JSON files
   - `data/conversations/`: Conversation files (`{conversation_id}.json`)
   - `data/escalations/`: Escalation files (`{conversation_id}_escalation.json`)

### Directory Structure

```
data/
├── conversations/
│   ├── {uuid-1}.json
│   ├── {uuid-2}.json
│   └── ...
└── escalations/
    ├── {uuid-1}_escalation.json
    ├── {uuid-2}_escalation.json
    └── ...
```

## How It Works

### Conversation Storage Flow

**Saving a Conversation:**
1. Function receives `conversation_id`, `messages`, `escalated` flag, and optional `title`
2. Checks if conversation file already exists
3. If exists, preserves `created_at` timestamp and existing title
4. If new, generates `created_at` timestamp and auto-generates title from first user message
5. Updates `updated_at` timestamp
6. Saves to `data/conversations/{conversation_id}.json`
7. Returns conversation data dictionary

**Loading a Conversation:**
1. Function receives `conversation_id`
2. Constructs file path: `data/conversations/{conversation_id}.json`
3. Checks if file exists
4. Loads JSON file safely (handles corruption gracefully)
5. Returns conversation data dictionary or `None` if not found

**Listing Conversations:**
1. Scans `data/conversations/` directory
2. Loads each `.json` file
3. Extracts summary information (id, title, timestamps, escalated status, message count)
4. Sorts by `updated_at` (most recent first)
5. Returns list of conversation summaries

**Deleting a Conversation:**
1. Function receives `conversation_id`
2. Constructs file path
3. Checks if file exists
4. Deletes file using `os.remove()`
5. Returns `True` if successful, `False` otherwise

### Escalation Storage Flow

**Saving an Escalation:**
1. Function receives `conversation_id`, `reason`, `contact_info`, and `priority`
2. Creates escalation data structure with timestamp and status
3. Saves to `data/escalations/{conversation_id}_escalation.json`
4. Returns escalation data dictionary

**Loading an Escalation:**
1. Function receives `conversation_id`
2. Constructs file path with `_escalation` suffix
3. Loads JSON file safely
4. Returns escalation data dictionary or `None` if not found

**Listing Escalations:**
1. Scans `data/escalations/` directory
2. Filters files ending with `_escalation.json`
3. Loads each escalation file
4. Sorts by timestamp (most recent first)
5. Returns list of escalation dictionaries

### Auto-Cleanup Flow

**Cleanup Process:**
1. Function receives `timeout_hours` parameter (default: 24)
2. Calculates threshold timestamp: `now - timeout_hours`
3. Scans all conversation files in `data/conversations/`
4. For each conversation:
   - Loads conversation data
   - Parses `updated_at` timestamp
   - Compares with threshold
   - If older than threshold, deletes conversation file
5. Returns statistics: `{'deleted': count, 'errors': count}`

**When to Run Cleanup:**
- Can be called manually via API endpoint
- Can be scheduled to run periodically (e.g., daily cron job)
- Can be called on application startup

## Data Structures

### Conversation Record Structure

Conversation records are saved as JSON files in `data/conversations/`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-01-15T10:30:14.930504",
  "updated_at": "2025-01-15T10:35:22.123456",
  "title": "Hello! I'm interested in training...",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant..."
    },
    {
      "role": "user",
      "content": "Hello!"
    },
    {
      "role": "assistant",
      "content": "Hi there! How can I help?"
    }
  ],
  "escalated": false
}
```

**Key Fields:**
- `id`: Unique conversation identifier (UUID)
- `created_at`: ISO timestamp when conversation was first created
- `updated_at`: ISO timestamp when conversation was last modified
- `title`: Auto-generated from first user message (first 50 chars)
- `messages`: Array of message objects with `role` and `content`
- `escalated`: Boolean indicating if conversation has been escalated

### Escalation Record Structure

Escalation records are saved as JSON files in `data/escalations/`:

**Low Priority Escalation:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:14.930504",
  "reason": "Handover confirmation - customer details collected",
  "contact_info": {
    "name": "John Doe",
    "mobile": "0123456789",
    "email": "john@example.com",
    "goal": "Competition prep",
    "plan": "Online coaching (Weekly)"
  },
  "priority": "low",
  "status": "pending"
}
```

**Key Fields:**
- `conversation_id`: Links escalation to conversation
- `timestamp`: ISO timestamp when escalation was created
- `reason`: Description of why escalation was created
- `contact_info`: User contact details and context
- `priority`: `"low"` or `"high"`
- `status`: Current status (typically `"pending"`)

## API Functions

### Conversation Functions

#### `save_conversation(conversation_id, messages, escalated=False, title=None)`

Saves a conversation to file.

**Parameters:**
- `conversation_id` (str): Unique identifier for the conversation
- `messages` (list): List of message dictionaries with `role` and `content`
- `escalated` (bool): Whether conversation is escalated (default: False)
- `title` (str, optional): Conversation title (auto-generated if None)

**Returns:**
- `dict`: Conversation data dictionary, or `None` on error

**Raises:**
- `OSError`: If storage operation fails (disk full, permissions, etc.)

**Example:**
```python
from utils.storage import save_conversation

messages = [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello"}
]
result = save_conversation("test-123", messages, escalated=False)
```

#### `load_conversation(conversation_id)`

Loads a conversation from file.

**Parameters:**
- `conversation_id` (str): Unique identifier for the conversation

**Returns:**
- `dict`: Conversation data dictionary, or `None` if not found

**Example:**
```python
from utils.storage import load_conversation

conversation = load_conversation("test-123")
if conversation:
    print(f"Title: {conversation['title']}")
    print(f"Messages: {len(conversation['messages'])}")
```

#### `list_conversations()`

Lists all saved conversations.

**Returns:**
- `list`: List of conversation summary dictionaries, sorted by `updated_at` (most recent first)

**Example:**
```python
from utils.storage import list_conversations

conversations = list_conversations()
for conv in conversations:
    print(f"{conv['title']} - {conv['message_count']} messages")
```

#### `delete_conversation(conversation_id)`

Deletes a conversation file.

**Parameters:**
- `conversation_id` (str): Unique identifier for the conversation

**Returns:**
- `bool`: `True` if deleted successfully, `False` otherwise

**Raises:**
- `OSError`: If deletion fails due to permissions or other OS errors

**Example:**
```python
from utils.storage import delete_conversation

success = delete_conversation("test-123")
if success:
    print("Conversation deleted")
```

### Escalation Functions

#### `save_escalation(conversation_id, reason, contact_info, priority='low')`

Saves an escalation request.

**Parameters:**
- `conversation_id` (str): Unique identifier for the conversation
- `reason` (str): Reason for escalation
- `contact_info` (dict): User contact information dictionary
- `priority` (str): Priority level - `'low'` or `'high'` (default: `'low'`)

**Returns:**
- `dict`: Escalation data dictionary, or `None` on error

**Example:**
```python
from utils.storage import save_escalation

contact_info = {
    "name": "John Doe",
    "mobile": "0123456789",
    "email": "john@example.com"
}
escalation = save_escalation(
    "test-123",
    "Customer requested assistance",
    contact_info,
    priority="high"
)
```

#### `load_escalation(conversation_id)`

Loads an escalation by conversation ID.

**Parameters:**
- `conversation_id` (str): Unique identifier for the conversation

**Returns:**
- `dict`: Escalation data dictionary, or `None` if not found

**Example:**
```python
from utils.storage import load_escalation

escalation = load_escalation("test-123")
if escalation:
    print(f"Priority: {escalation['priority']}")
    print(f"Status: {escalation['status']}")
```

#### `list_escalations()`

Lists all escalations.

**Returns:**
- `list`: List of escalation dictionaries, sorted by timestamp (most recent first)

**Example:**
```python
from utils.storage import list_escalations

escalations = list_escalations()
for esc in escalations:
    print(f"{esc['priority']} - {esc['contact_info']['name']}")
```

### Cleanup Functions

#### `cleanup_old_sessions(timeout_hours=24)`

Removes old conversation sessions that haven't been updated within timeout period.

**Parameters:**
- `timeout_hours` (int): Number of hours after which a session is considered old (default: 24)

**Returns:**
- `dict`: Dictionary with cleanup statistics: `{'deleted': count, 'errors': count}`

**Example:**
```python
from utils.storage import cleanup_old_sessions

# Clean up sessions older than 24 hours
stats = cleanup_old_sessions(timeout_hours=24)
print(f"Deleted: {stats['deleted']}, Errors: {stats['errors']}")

# Clean up sessions older than 48 hours
stats = cleanup_old_sessions(timeout_hours=48)
```

## Helper Functions (Private)

The module includes private helper functions (prefixed with `_`) for internal use:

- `_ensure_dir_exists(directory)`: Creates directory if it doesn't exist
- `_get_file_path(directory, file_id, suffix='')`: Builds file path consistently
- `_load_json_file(file_path)`: Loads JSON file safely, handles corruption
- `_save_json_file(file_path, data)`: Saves data to JSON file with error handling

## Error Handling

The storage module implements comprehensive error handling:

### Storage Errors

**Disk Full (errno 28):**
- Detected and logged
- Exception raised to caller
- Flask app returns HTTP 507 (Insufficient Storage)

**Permission Denied (errno 13):**
- Detected and logged
- Exception raised to caller
- Flask app returns HTTP 500 with permission error message

**File Corruption:**
- JSON decode errors are caught
- Function returns `None` instead of crashing
- Error is logged for debugging

**Missing Files:**
- Functions return `None` or `False` (not exceptions)
- Allows graceful handling by calling code

### Logging

All errors are logged using Python's `logging` module:
- JSON decode errors
- IO errors
- OS errors (permissions, disk full)
- Unexpected exceptions (with full traceback)

## Integration with Flask App

### Import Statement

```python
from utils.storage import (
    save_conversation,
    load_conversation,
    list_conversations as get_all_conversations,
    delete_conversation as storage_delete_conversation,
    save_escalation,
)
```

### Usage in Routes

**Starting a Session:**
```python
@app.route("/api/start_session", methods=["POST"])
def start_session():
    conversation_id = str(uuid.uuid4())
    # ... initialize messages ...
    save_conversation(conversation_id, messages, False)
    # ... return response ...
```

**Saving Messages:**
```python
@app.route("/api/chat", methods=["POST"])
def send_message():
    # ... process message ...
    save_conversation(
        conversation_id,
        chat_sessions[conversation_id]["messages"],
        escalated
    )
    # ... return response ...
```

**Error Handling:**
```python
try:
    save_conversation(conversation_id, messages, False)
except OSError as e:
    if e.errno == 28:  # Disk full
        return jsonify({"error": "Storage full"}), 507
    elif e.errno == 13:  # Permission denied
        return jsonify({"error": "Permission denied"}), 500
```

## Testing

### Manual Testing with Python REPL

**Test Basic Operations:**
```python
from utils.storage import (
    save_conversation,
    load_conversation,
    list_conversations,
    delete_conversation
)
import uuid

# Create test conversation
test_id = f"test-{uuid.uuid4()}"
messages = [
    {"role": "system", "content": "Test"},
    {"role": "user", "content": "Hello"}
]

# Save
saved = save_conversation(test_id, messages)
print(f"Saved: {saved is not None}")

# Load
loaded = load_conversation(test_id)
print(f"Loaded: {loaded is not None}")
print(f"Matches: {saved == loaded}")

# List
all_convs = list_conversations()
print(f"Total conversations: {len(all_convs)}")

# Delete
deleted = delete_conversation(test_id)
print(f"Deleted: {deleted}")
print(f"Still exists: {load_conversation(test_id) is not None}")
```

## Files Modified

1. **New Files:**
   - `utils/storage.py` - Core storage module

2. **Modified Files:**
   - `app.py` - Imports storage functions and uses them in routes
   - Removed inline storage functions from `app.py` (refactored to storage module)

## Installation & Setup

### Prerequisites

No additional dependencies required. Uses Python standard library:
- `os` - File operations
- `json` - JSON serialization
- `datetime` - Timestamp handling
- `logging` - Error logging

### Directory Setup

Directories are automatically created on module import:
- `data/conversations/` - Created automatically
- `data/escalations/` - Created automatically

### Configuration

No configuration required. The module uses default paths:
- `DATA_DIR = 'data'`
- `CONVERSATIONS_DIR = 'data/conversations'`
- `ESCALATIONS_DIR = 'data/escalations'`

### Initialization

The module initializes directories automatically when imported:

```python
# Initialize directories on import
_ensure_dir_exists(CONVERSATIONS_DIR)
_ensure_dir_exists(ESCALATIONS_DIR)
```

## Best Practices

### File Naming

- Conversations: `{conversation_id}.json`
- Escalations: `{conversation_id}_escalation.json`
- Consistent naming ensures easy lookup and cleanup

### Error Handling

- Always wrap storage calls in try/except blocks
- Handle `OSError` for disk/permission issues
- Check return values (`None` for load operations, `False` for delete)

### Performance Considerations

- File I/O is synchronous (blocking)
- For high-traffic applications, consider:
  - Async file operations
  - Database migration (SQLite, PostgreSQL)
  - Caching layer (Redis)

### Data Integrity

- JSON files are human-readable for debugging
- Timestamps use ISO format for consistency
- File corruption is handled gracefully (returns `None`)

## Future Enhancements

Potential improvements:

1. **Database Migration:**
   - Add SQLite support for better performance
   - Migrate existing JSON files to database
   - Support for PostgreSQL for production

2. **Caching Layer:**
   - Add Redis caching for frequently accessed conversations
   - Reduce file I/O operations

3. **Backup System:**
   - Automatic backup of conversation files
   - Version history for conversations
   - Export/import functionality

4. **Search Functionality:**
   - Full-text search across conversations
   - Search by keywords, dates, escalation status

5. **Analytics:**
   - Conversation statistics (total, escalated, average length)
   - Storage usage monitoring
   - Cleanup analytics

6. **User Storage:**
   - Implement user profile storage (currently boilerplate)
   - User authentication integration
   - User preferences storage

7. **Batch Operations:**
   - Bulk delete conversations
   - Bulk export conversations
   - Batch cleanup with progress tracking

8. **Compression:**
   - Compress old conversation files
   - Reduce storage footprint
   - Decompress on-demand

9. **Monitoring:**
   - Storage health checks
   - Disk space monitoring
   - File count limits

10. **Migration Tools:**
    - Script to migrate JSON to database
    - Backup/restore utilities
    - Data validation tools

