
import { useEffect, useState } from "react";

function Search({ darkMode, toggleTheme, onLogout, onDashboard, user, token }) {
    const [filters, setFilters] = useState({
        title: "",
        author: "",
        publisher: ""
    });

    const [selectedGenres, setSelectedGenres] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);

    const [filterOptionsOpen, setFilterOptionsOpen] = useState(false);
    const [availableGenres, setAvailableGenres] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    const [books, setBooks] = useState([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const response = await fetch(
                    "http://localhost:5000/api/books/filters"
                );

                if (!response.ok) {
                    throw new Error("Failed to load filter options");
                }

                const data = await response.json();

                setAvailableGenres(data.genres || []);
                setAvailableTags(data.tags || []);
            } catch (err) {
                console.error("Filter options error:", err);
            }
        };

        fetchFilterOptions();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFilters((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    const toggleSelection = (value, selected, setSelected) => {
        setSelected((previous) =>
            previous.includes(value)
                ? previous.filter((item) => item !== value)
                : [...previous, value]
        );
    };

    const handleSearch = async (e) => {
        e.preventDefault();

        const hasFilter =
            Object.values(filters).some((value) => value.trim() !== "") ||
            selectedGenres.length > 0 ||
            selectedTags.length > 0;

        if (!hasFilter) {
            alert("Please enter a search term or select a filter.");
            return;
        }

        const params = new URLSearchParams();

        Object.entries(filters).forEach(([key, value]) => {
            if (value.trim()) {
                params.append(key, value.trim());
            }
        });

        selectedGenres.forEach((genre) => {
            params.append("genre", genre);
        });

        selectedTags.forEach((tag) => {
            params.append("tag", tag);
        });

        setLoading(true);
        setError("");
        setActionError("");
        setSearched(false);

        try {
            const response = await fetch(
                `http://localhost:5000/api/books/search?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const responseText = await response.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(
                    "The server returned HTML instead of JSON. Check that the backend is running and the search route exists."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.error || data.message || "Search request failed"
                );
            }

            setBooks(Array.isArray(data) ? data : []);
            setSearched(true);
        } catch (err) {
            console.error("Search error:", err);
            setError(err.message || "Unable to retrieve books.");
        } finally {
            setLoading(false);
        }
    };

    const updateBookAction = async (book, action) => {
        setActionError("");

        if (!token) {
            setActionError("Please log in again to update your books.");
            return;
        }

        const isLiked = Boolean(Number(book.Is_Liked));
        const inReadingList = Boolean(Number(book.In_Reading_List));

        const remove = action === "like" ? isLiked : inReadingList;
        const endpoint = action === "like" ? "like" : "reading-list";
        const method = remove ? "DELETE" : "POST";

        try {
            const response = await fetch(
                `http://localhost:5000/api/books/${book.Book_ID}/${endpoint}`,
                {
                    method,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            // Read the response as text first to avoid a JSON parsing crash
            // if the server accidentally returns an HTML error page.
            const responseText = await response.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch {
                console.error(
                    "Non-JSON response from book action:",
                    responseText
                );

                throw new Error(
                    "The server returned HTML instead of JSON. Check the backend route in server.js and make sure the request uses port 5000."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.error || data.message || "Could not update book."
                );
            }

            // Update the displayed book only after the server succeeds.
            setBooks((previous) =>
                previous
                    .map((item) => {
                        if (item.Book_ID !== book.Book_ID) {
                            return item;
                        }

                        if (action === "like") {
                            return {
                                ...item,
                                Is_Liked: remove ? 0 : 1,
                                Like_Count: Math.max(
                                    0,
                                    Number(item.Like_Count || 0) +
                                        (remove ? -1 : 1)
                                )
                            };
                        }

                        return {
                            ...item,
                            In_Reading_List: remove ? 0 : 1
                        };
                    })
                    .sort(
                        (a, b) =>
                            Number(b.Like_Count || 0) -
                                Number(a.Like_Count || 0) ||
                            a.Title.localeCompare(b.Title)
                    )
            );
        } catch (err) {
            console.error("Book action error:", err);
            setActionError(err.message || "Could not update book.");
        }
    };

    const handleClear = () => {
        setFilters({
            title: "",
            author: "",
            publisher: ""
        });

        setSelectedGenres([]);
        setSelectedTags([]);
        setBooks([]);
        setSearched(false);
        setError("");
        setActionError("");
    };

    return (
        <div className="search-page">
            <div className="top-buttons">
                <button
                    type="button"
                    className="theme-button"
                    onClick={toggleTheme}
                >
                    {darkMode ? "Light Mode" : "Dark Mode"}
                </button>

                <button
                    type="button"
                    className="theme-button"
                    onClick={onDashboard}
                >
                    Dashboard
                </button>

                <button
                    type="button"
                    className="theme-button"
                    onClick={onLogout}
                >
                    Logout
                </button>
            </div>

            <main className="search-content">
                <h1>Page Turner</h1>
                <p>Find your next great read</p>

                {user && (
                    <p className="welcome-message">
                        Welcome, {user.Name}!
                    </p>
                )}

                <form onSubmit={handleSearch} className="search-form">
                    <div className="title-filter-row">
                        <input
                            id="title"
                            name="title"
                            type="text"
                            placeholder="Search for a book..."
                            value={filters.title}
                            onChange={handleChange}
                        />

                        <button
                            type="button"
                            className="filter-icon-button"
                            aria-label="Open genre and tag filters"
                            aria-expanded={filterOptionsOpen}
                            title="Filter by genre and tags"
                            onClick={() =>
                                setFilterOptionsOpen((previous) => !previous)
                            }
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="22"
                                height="22"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z" />
                            </svg>

                            {selectedGenres.length + selectedTags.length > 0 && (
                                <span className="filter-count">
                                    {selectedGenres.length + selectedTags.length}
                                </span>
                            )}
                        </button>

                        {filterOptionsOpen && (
                            <div className="filter-dropdown">
                                <div className="filter-dropdown-header">
                                    <strong>Filter Books</strong>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFilterOptionsOpen(false)
                                        }
                                        aria-label="Close filters"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="filter-section">
                                    <h4>Genre</h4>

                                    {availableGenres.map((genre) => (
                                        <label
                                            className="filter-option"
                                            key={genre}
                                        >
                                            <span>{genre}</span>

                                            <input
                                                type="checkbox"
                                                checked={selectedGenres.includes(
                                                    genre
                                                )}
                                                onChange={() =>
                                                    toggleSelection(
                                                        genre,
                                                        selectedGenres,
                                                        setSelectedGenres
                                                    )
                                                }
                                            />
                                        </label>
                                    ))}

                                    {availableGenres.length === 0 && (
                                        <p>No genres available.</p>
                                    )}
                                </div>

                                <div className="filter-section">
                                    <h4>Tags</h4>

                                    {availableTags.map((tag) => (
                                        <label
                                            className="filter-option"
                                            key={tag}
                                        >
                                            <span>{tag}</span>

                                            <input
                                                type="checkbox"
                                                checked={selectedTags.includes(
                                                    tag
                                                )}
                                                onChange={() =>
                                                    toggleSelection(
                                                        tag,
                                                        selectedTags,
                                                        setSelectedTags
                                                    )
                                                }
                                            />
                                        </label>
                                    ))}

                                    {availableTags.length === 0 && (
                                        <p>No tags available.</p>
                                    )}
                                </div>

                                <div className="filter-dropdown-footer">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedGenres([]);
                                            setSelectedTags([]);
                                        }}
                                    >
                                        Clear selections
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFilterOptionsOpen(false)
                                        }
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="filter-group">
                        <label htmlFor="author">Author</label>

                        <input
                            id="author"
                            name="author"
                            type="text"
                            placeholder="Enter author name..."
                            value={filters.author}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="publisher">Publisher</label>

                        <input
                            id="publisher"
                            name="publisher"
                            type="text"
                            placeholder="Enter publisher name..."
                            value={filters.publisher}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="filter-buttons">
                        <button type="submit" disabled={loading}>
                            {loading ? "Searching..." : "Search Books"}
                        </button>

                        <button type="button" onClick={handleClear}>
                            Clear All
                        </button>
                    </div>
                </form>

                {actionError && (
                    <p className="search-error" role="alert">
                        {actionError}
                    </p>
                )}

                {error && (
                    <p className="search-error" role="alert">
                        {error}
                    </p>
                )}

                {searched && !loading && !error && (
                    <div className="search-results">
                        <h2>Search Results</h2>

                        {books.length > 0 ? (
                            books.map((book) => (
                                <div
                                    className="book-result"
                                    key={book.Book_ID}
                                >
                                    <div className="book-result-heading">
                                        <h3>{book.Title}</h3>

                                        <div className="book-action-buttons">
                                            <button
                                                type="button"
                                                className={
                                                    Number(book.Is_Liked)
                                                        ? "book-action liked"
                                                        : "book-action"
                                                }
                                                onClick={() =>
                                                    updateBookAction(
                                                        book,
                                                        "like"
                                                    )
                                                }
                                                aria-label={
                                                    Number(book.Is_Liked)
                                                        ? `Unlike ${book.Title}`
                                                        : `Like ${book.Title}`
                                                }
                                                title={
                                                    Number(book.Is_Liked)
                                                        ? "Unlike book"
                                                        : "Like book"
                                                }
                                            >
                                                {Number(book.Is_Liked)
                                                    ? "♥"
                                                    : "♡"}
                                                <span>
                                                    {Number(book.Like_Count) || 0}
                                                </span>
                                            </button>

                                            <button
                                                type="button"
                                                className={
                                                    Number(book.In_Reading_List)
                                                        ? "book-action added"
                                                        : "book-action"
                                                }
                                                onClick={() =>
                                                    updateBookAction(
                                                        book,
                                                        "reading-list"
                                                    )
                                                }
                                                aria-label={
                                                    Number(book.In_Reading_List)
                                                        ? `Remove ${book.Title} from reading list`
                                                        : `Add ${book.Title} to reading list`
                                                }
                                                title={
                                                    Number(book.In_Reading_List)
                                                        ? "Remove from reading list"
                                                        : "Add to reading list"
                                                }
                                            >
                                                {Number(book.In_Reading_List)
                                                    ? "✓"
                                                    : "+"}
                                            </button>
                                        </div>
                                    </div>

                                    <p>
                                        <strong>Book Name:</strong>{" "}
                                        {book.Title}
                                    </p>

                                    <p>
                                        <strong>Genre:</strong>{" "}
                                        {book.Genre || "Not specified"}
                                    </p>

                                    <p>
                                        <strong>Author:</strong>{" "}
                                        {book.Author || "Not specified"}
                                    </p>

                                    <p>
                                        <strong>Publisher:</strong>{" "}
                                        {book.Publisher || "Not specified"}
                                    </p>

                                    <p>
                                        <strong>Tags:</strong>{" "}
                                        {book.Tags || "No tags assigned"}
                                    </p>

                                    <p>
                                        <strong>Publication Date:</strong>{" "}
                                        {book.Publication_Year ?? "Unknown"}
                                    </p>

                                    <p>
                                        <strong>Status:</strong>{" "}
                                        {book.Series_Status || "Not specified"}
                                    </p>

                                    <div className="book-description">
                                        <strong>Description</strong>

                                        <p>
                                            {book.Description ||
                                                "No description available."}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>No matching books found.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default Search;
