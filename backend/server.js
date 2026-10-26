
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// ==================== JWT AUTHENTICATION ====================

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token || !process.env.JWT_SECRET) {
        return res.status(401).json({
            error: 'Authentication required.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.User_ID;
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Invalid or expired token.'
        });
    }
}

// ==================== USER REGISTRATION ====================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { Name, Email, Password } = req.body;

        if (
            typeof Name !== 'string' ||
            typeof Email !== 'string' ||
            typeof Password !== 'string' ||
            !Name.trim() ||
            !Email.trim() ||
            !Password
        ) {
            return res.status(400).json({
                error: 'Name, email, and password are required.'
            });
        }

        if (Name.trim().length > 100 || Email.trim().length > 150) {
            return res.status(400).json({
                error: 'Name or email is too long.'
            });
        }

        if (Password.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters long.'
            });
        }

        const email = Email.trim().toLowerCase();

        const [existingUsers] = await pool.execute(
            'SELECT User_ID FROM app_user WHERE Email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                error: 'An account with this email already exists.'
            });
        }

        const hashedPassword = await bcrypt.hash(Password, 12);

        const [result] = await pool.execute(
            `INSERT INTO app_user (Name, Email, Password)
             VALUES (?, ?, ?)`,
            [Name.trim(), email, hashedPassword]
        );

        res.status(201).json({
            message: 'Account created successfully.',
            user: {
                User_ID: result.insertId,
                Name: Name.trim(),
                Email: email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'An account with this email already exists.'
            });
        }

        res.status(500).json({
            error: 'Unable to create account.'
        });
    }
});

// ==================== USER LOGIN ====================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { Email, Password } = req.body;

        if (
            typeof Email !== 'string' ||
            typeof Password !== 'string' ||
            !Email.trim() ||
            !Password
        ) {
            return res.status(400).json({
                error: 'Email and password are required.'
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is missing from .env');

            return res.status(500).json({
                error: 'Authentication is not configured.'
            });
        }

        const email = Email.trim().toLowerCase();

        const [users] = await pool.execute(
            `SELECT User_ID, Name, Email, Password, Reading_Goal
             FROM app_user
             WHERE Email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            Password,
            user.Password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        const token = jwt.sign(
            { User_ID: user.User_ID },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            message: 'Login successful.',
            token,
            user: {
                User_ID: user.User_ID,
                Name: user.Name,
                Email: user.Email,
                Reading_Goal: user.Reading_Goal
            }
        });
    } catch (error) {
        console.error('Login error:', error);

        res.status(500).json({
            error: 'Unable to log in.'
        });
    }
});

// ==================== GET ALL BOOKS ====================

app.get('/api/books', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                b.Book_ID,
                b.Title,
                b.ISBN,
                b.Publication_Year,
                b.Description,
                b.Series_Status,
                GROUP_CONCAT(
                    DISTINCT g.Genre_Name
                    ORDER BY g.Genre_Name
                    SEPARATOR ', '
                ) AS Genre
            FROM BOOK b
            LEFT JOIN BOOK_GENRE bg
                ON b.Book_ID = bg.Book_ID
            LEFT JOIN GENRE g
                ON bg.Genre_ID = g.Genre_ID
            GROUP BY
                b.Book_ID,
                b.Title,
                b.ISBN,
                b.Publication_Year,
                b.Description,
                b.Series_Status
        `);

        res.json(rows);
    } catch (error) {
        console.error('Error fetching books:', error);

        res.status(500).json({
            error: 'Failed to retrieve books'
        });
    }
});

// ==================== ADD A BOOK ====================

app.post('/api/books', async (req, res) => {
    try {
        const {
            Title,
            ISBN,
            Publication_Year,
            Description,
            Series_Status,
            Publisher_ID
        } = req.body;

        if (typeof Title !== 'string' || !Title.trim()) {
            return res.status(400).json({
                error: 'Book title is required.'
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO BOOK
             (Title, ISBN, Publication_Year, Description,
              Series_Status, Publisher_ID)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                Title.trim(),
                ISBN || null,
                Publication_Year || null,
                Description || null,
                Series_Status || null,
                Publisher_ID || null
            ]
        );

        res.status(201).json({
            message: 'Book added successfully',
            Book_ID: result.insertId
        });
    } catch (error) {
        console.error('Error adding book:', error);

        res.status(500).json({
            error: 'Failed to add book'
        });
    }
});

// ==================== UPDATE A BOOK ====================

app.put('/api/books/:id', async (req, res) => {
    try {
        const {
            Title,
            ISBN,
            Publication_Year,
            Description,
            Series_Status
        } = req.body;

        const { id } = req.params;

        const [result] = await pool.execute(
            `UPDATE BOOK
             SET Title = ?, ISBN = ?, Publication_Year = ?,
                 Description = ?, Series_Status = ?
             WHERE Book_ID = ?`,
            [
                Title,
                ISBN || null,
                Publication_Year || null,
                Description || null,
                Series_Status || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Book not found'
            });
        }

        res.json({
            message: 'Book updated successfully'
        });
    } catch (error) {
        console.error('Error updating book:', error);

        res.status(500).json({
            error: 'Failed to update book'
        });
    }
});

// ==================== DELETE A BOOK ====================

app.delete('/api/books/:id', async (req, res) => {
    try {
        const [result] = await pool.execute(
            'DELETE FROM BOOK WHERE Book_ID = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Book not found'
            });
        }

        res.json({
            message: 'Book deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting book:', error);

        res.status(500).json({
            error: 'Failed to delete book'
        });
    }
});

// ==================== SEARCH BOOKS ====================

app.get('/api/books/search', authenticateToken, async (req, res) => {
    try {
        const { title, author, publisher } = req.query;

        const genres = []
            .concat(req.query.genre || [])
            .filter(Boolean);

        const tags = []
            .concat(req.query.tag || [])
            .filter(Boolean);

        let sql = `
            SELECT
                b.Book_ID,
                b.Title,
                b.ISBN,
                b.Publication_Year,
                b.Description,
                b.Series_Status,
                p.Publisher_Name AS Publisher,

                (
                    SELECT COUNT(*)
                    FROM USER_LIKED_BOOK ulc
                    WHERE ulc.Book_ID = b.Book_ID
                ) AS Like_Count,

                EXISTS (
                    SELECT 1
                    FROM USER_LIKED_BOOK ulm
                    WHERE ulm.Book_ID = b.Book_ID
                      AND ulm.User_ID = ?
                ) AS Is_Liked,

                EXISTS (
                    SELECT 1
                    FROM USER_READING_LIST url
                    WHERE url.Book_ID = b.Book_ID
                      AND url.User_ID = ?
                ) AS In_Reading_List,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT g.Genre_Name
                        ORDER BY g.Genre_Name SEPARATOR ', '
                    )
                    FROM BOOK_GENRE bg
                    JOIN GENRE g
                        ON g.Genre_ID = bg.Genre_ID
                    WHERE bg.Book_ID = b.Book_ID
                ) AS Genre,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT a.Author_Name
                        ORDER BY a.Author_Name SEPARATOR ', '
                    )
                    FROM BOOK_AUTHOR ba
                    JOIN AUTHOR a
                        ON a.Author_ID = ba.Author_ID
                    WHERE ba.Book_ID = b.Book_ID
                ) AS Author,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT t.Tag_Name
                        ORDER BY t.Tag_Name SEPARATOR ', '
                    )
                    FROM BOOK_TAG bt
                    JOIN TAG t
                        ON t.Tag_ID = bt.Tag_ID
                    WHERE bt.Book_ID = b.Book_ID
                ) AS Tags

            FROM BOOK b
            LEFT JOIN PUBLISHER p
                ON p.Publisher_ID = b.Publisher_ID
            WHERE 1 = 1
        `;

        const params = [req.userId, req.userId];

        if (typeof title === 'string' && title.trim()) {
            sql += ' AND b.Title LIKE ?';
            params.push(`%${title.trim()}%`);
        }

        if (typeof author === 'string' && author.trim()) {
            sql += ` AND EXISTS (
                SELECT 1
                FROM BOOK_AUTHOR ba
                JOIN AUTHOR a
                    ON a.Author_ID = ba.Author_ID
                WHERE ba.Book_ID = b.Book_ID
                  AND a.Author_Name LIKE ?
            )`;

            params.push(`%${author.trim()}%`);
        }

        if (typeof publisher === 'string' && publisher.trim()) {
            sql += ' AND p.Publisher_Name LIKE ?';
            params.push(`%${publisher.trim()}%`);
        }

        if (genres.length > 0) {
            sql += ` AND EXISTS (
                SELECT 1
                FROM BOOK_GENRE bg
                JOIN GENRE g
                    ON g.Genre_ID = bg.Genre_ID
                WHERE bg.Book_ID = b.Book_ID
                  AND g.Genre_Name IN (
                      ${genres.map(() => '?').join(', ')}
                  )
            )`;

            params.push(...genres);
        }

        if (tags.length > 0) {
            sql += ` AND EXISTS (
                SELECT 1
                FROM BOOK_TAG bt
                JOIN TAG t
                    ON t.Tag_ID = bt.Tag_ID
                WHERE bt.Book_ID = b.Book_ID
                  AND t.Tag_Name IN (
                      ${tags.map(() => '?').join(', ')}
                  )
            )`;

            params.push(...tags);
        }

        sql += ' ORDER BY Like_Count DESC, b.Title ASC';

        const [rows] = await pool.execute(sql, params);

        res.json(rows);
    } catch (error) {
        console.error('Advanced search error:', error);

        res.status(500).json({
            error: 'Failed to search books'
        });
    }
});

// ==================== LIKE / UNLIKE BOOKS ====================

app.post('/api/books/:id/like', authenticateToken, async (req, res) => {
    try {
        const bookId = Number(req.params.id);

        if (!Number.isInteger(bookId) || bookId < 1) {
            return res.status(400).json({
                error: 'Invalid book ID.'
            });
        }

        const [books] = await pool.execute(
            'SELECT Book_ID FROM BOOK WHERE Book_ID = ?',
            [bookId]
        );

        if (books.length === 0) {
            return res.status(404).json({
                error: 'Book not found.'
            });
        }

        await pool.execute(
            `INSERT IGNORE INTO USER_LIKED_BOOK (User_ID, Book_ID)
             VALUES (?, ?)`,
            [req.userId, bookId]
        );

        res.json({
            message: 'Book liked.'
        });
    } catch (error) {
        console.error('Like book error:', error);

        res.status(500).json({
            error: 'Unable to like this book.'
        });
    }
});

app.delete('/api/books/:id/like', authenticateToken, async (req, res) => {
    try {
        await pool.execute(
            `DELETE FROM USER_LIKED_BOOK
             WHERE User_ID = ? AND Book_ID = ?`,
            [req.userId, req.params.id]
        );

        res.json({
            message: 'Like removed.'
        });
    } catch (error) {
        console.error('Unlike book error:', error);

        res.status(500).json({
            error: 'Unable to remove like.'
        });
    }
});

// ==================== READING LIST ====================

app.post('/api/books/:id/reading-list', authenticateToken, async (req, res) => {
    try {
        const bookId = Number(req.params.id);

        if (!Number.isInteger(bookId) || bookId < 1) {
            return res.status(400).json({
                error: 'Invalid book ID.'
            });
        }

        const [books] = await pool.execute(
            'SELECT Book_ID FROM BOOK WHERE Book_ID = ?',
            [bookId]
        );

        if (books.length === 0) {
            return res.status(404).json({
                error: 'Book not found.'
            });
        }

        await pool.execute(
            `INSERT IGNORE INTO USER_READING_LIST (User_ID, Book_ID)
             VALUES (?, ?)`,
            [req.userId, bookId]
        );

        res.json({
            message: 'Book added to reading list.'
        });
    } catch (error) {
        console.error('Add to reading list error:', error);

        res.status(500).json({
            error: 'Unable to update reading list.'
        });
    }
});

app.delete('/api/books/:id/reading-list', authenticateToken, async (req, res) => {
    try {
        await pool.execute(
            `DELETE FROM USER_READING_LIST
             WHERE User_ID = ? AND Book_ID = ?`,
            [req.userId, req.params.id]
        );

        res.json({
            message: 'Book removed from reading list.'
        });
    } catch (error) {
        console.error('Remove from reading list error:', error);

        res.status(500).json({
            error: 'Unable to update reading list.'
        });
    }
});

// ==================== USER DASHBOARD ====================

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const [likedBooks] = await pool.execute(`
            SELECT
                b.Book_ID,
                b.Title,
                b.Publication_Year,
                b.Description,
                b.Series_Status,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT g.Genre_Name
                        ORDER BY g.Genre_Name SEPARATOR ', '
                    )
                    FROM BOOK_GENRE bg
                    JOIN GENRE g ON g.Genre_ID = bg.Genre_ID
                    WHERE bg.Book_ID = b.Book_ID
                ) AS Genre,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT a.Author_Name
                        ORDER BY a.Author_Name SEPARATOR ', '
                    )
                    FROM BOOK_AUTHOR ba
                    JOIN AUTHOR a ON a.Author_ID = ba.Author_ID
                    WHERE ba.Book_ID = b.Book_ID
                ) AS Author

            FROM USER_LIKED_BOOK ul
            JOIN BOOK b ON b.Book_ID = ul.Book_ID
            WHERE ul.User_ID = ?
            ORDER BY ul.Date_Liked DESC, b.Title ASC
        `, [req.userId]);

        const [readingList] = await pool.execute(`
            SELECT
                b.Book_ID,
                b.Title,
                b.Publication_Year,
                b.Description,
                b.Series_Status,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT g.Genre_Name
                        ORDER BY g.Genre_Name SEPARATOR ', '
                    )
                    FROM BOOK_GENRE bg
                    JOIN GENRE g ON g.Genre_ID = bg.Genre_ID
                    WHERE bg.Book_ID = b.Book_ID
                ) AS Genre,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT a.Author_Name
                        ORDER BY a.Author_Name SEPARATOR ', '
                    )
                    FROM BOOK_AUTHOR ba
                    JOIN AUTHOR a ON a.Author_ID = ba.Author_ID
                    WHERE ba.Book_ID = b.Book_ID
                ) AS Author

            FROM USER_READING_LIST url
            JOIN BOOK b ON b.Book_ID = url.Book_ID
            WHERE url.User_ID = ?
            ORDER BY url.Added_At DESC, b.Title ASC
        `, [req.userId]);

        res.json({
            likedBooks,
            readingList
        });
    } catch (error) {
        console.error('Dashboard error:', error);

        res.status(500).json({
            error: 'Unable to load dashboard.'
        });
    }
});

// ==================== GENRE AND TAG FILTER OPTIONS ====================

app.get('/api/books/filters', async (req, res) => {
    try {
        const [genres] = await pool.query(
            'SELECT Genre_Name FROM GENRE ORDER BY Genre_Name'
        );

        const [tags] = await pool.query(
            'SELECT Tag_Name FROM TAG ORDER BY Tag_Name'
        );

        res.json({
            genres: genres.map((row) => row.Genre_Name),
            tags: tags.map((row) => row.Tag_Name)
        });
    } catch (error) {
        console.error('Error fetching filters:', error);

        res.status(500).json({
            error: 'Failed to retrieve filter options'
        });
    }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
