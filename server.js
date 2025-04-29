const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Setup SQLite database connection
const db = new sqlite3.Database('./notes.db', (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Use timestamp + original name to avoid collisions
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// --- API Endpoints ---

// --- Folders ---

// Get all folders
app.get('/folders', (req, res) => {
  db.all('SELECT * FROM folders ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create a new folder
app.post('/folders', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name is required' });

  const sql = 'INSERT INTO folders (name) VALUES (?)';
  db.run(sql, [name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Folder name must be unique' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, name });
  });
});

// --- Notes ---

// Get all notes in a folder
app.get('/folders/:folderId/notes', (req, res) => {
  const folderId = req.params.folderId;
  const sql = 'SELECT * FROM notes WHERE folder_id = ? ORDER BY updated_at DESC';
  db.all(sql, [folderId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create a new note in a folder
app.post('/folders/:folderId/notes', (req, res) => {
  const folderId = req.params.folderId;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Note name is required' });

  const sql = 'INSERT INTO notes (folder_id, name) VALUES (?, ?)';
  db.run(sql, [folderId, name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, folder_id: folderId, name });
  });
});

// Get a specific note by id
app.get('/notes/:noteId', (req, res) => {
  const noteId = req.params.noteId;
  const sql = 'SELECT * FROM notes WHERE id = ?';
  db.get(sql, [noteId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Note not found' });
    res.json(row);
  });
});

// Update note name and updated_at timestamp
app.put('/notes/:noteId', (req, res) => {
  const noteId = req.params.noteId;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Note name is required' });

  const sql = 'UPDATE notes SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  db.run(sql, [name, noteId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Note not found' });
    res.json({ id: noteId, name });
  });
});

// Delete a note and its related contents and images
app.delete('/notes/:noteId', (req, res) => {
  const noteId = req.params.noteId;

  db.serialize(() => {
    // Delete images files from disk
    db.all('SELECT file_path FROM images WHERE note_id = ?', [noteId], (err, rows) => {
      if (!err && rows.length) {
        rows.forEach(({ file_path }) => {
          const fullPath = path.join(__dirname, file_path);
          fs.unlink(fullPath, (err) => {
            if (err) console.warn(`Failed to delete image file: ${fullPath}`);
          });
        });
      }
    });

    // Delete images records
    db.run('DELETE FROM images WHERE note_id = ?', [noteId]);

    // Delete note content records
    db.run('DELETE FROM note_content WHERE note_id = ?', [noteId]);

    // Delete note itself
    db.run('DELETE FROM notes WHERE id = ?', [noteId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Note not found' });
      res.json({ message: 'Note deleted' });
    });
  });
});

// --- Note Content ---

// Get all content for a note
app.get('/notes/:noteId/content', (req, res) => {
  const noteId = req.params.noteId;
  const sql = 'SELECT * FROM note_content WHERE note_id = ? ORDER BY id';
  db.all(sql, [noteId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add content to a note
app.post('/notes/:noteId/content', (req, res) => {
  const noteId = req.params.noteId;
  const { content_type, content } = req.body;

  if (!['text', 'drawing'].includes(content_type)) {
    return res.status(400).json({ error: "content_type must be 'text' or 'drawing'" });
  }
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' });
  }

  const sql = 'INSERT INTO note_content (note_id, content_type, content) VALUES (?, ?, ?)';
  db.run(sql, [noteId, content_type, content], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, note_id: noteId, content_type, content });
  });
});

// Update content by content id
app.put('/note_content/:contentId', (req, res) => {
  const contentId = req.params.contentId;
  const { content } = req.body;

  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' });
  }

  const sql = 'UPDATE note_content SET content = ? WHERE id = ?';
  db.run(sql, [content, contentId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Content not found' });
    res.json({ id: contentId, content });
  });
});

// Delete content by content id
app.delete('/note_content/:contentId', (req, res) => {
  const contentId = req.params.contentId;
  const sql = 'DELETE FROM note_content WHERE id = ?';
  db.run(sql, [contentId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Content not found' });
    res.json({ message: 'Content deleted' });
  });
});

// --- Images ---

// Get all images for a note
app.get('/notes/:noteId/images', (req, res) => {
  const noteId = req.params.noteId;
  const sql = 'SELECT * FROM images WHERE note_id = ? ORDER BY uploaded_at DESC';
  db.all(sql, [noteId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Upload an image for a note
app.post('/notes/:noteId/images', upload.single('image'), (req, res) => {
  const noteId = req.params.noteId;
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  const filePath = path.relative(__dirname, req.file.path);

  const sql = 'INSERT INTO images (note_id, file_path) VALUES (?, ?)';
  db.run(sql, [noteId, filePath], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, note_id: noteId, file_path: filePath });
  });
});

// Serve uploaded images statically
app.use('/uploads', express.static(UPLOAD_DIR));

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
