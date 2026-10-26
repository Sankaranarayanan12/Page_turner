import { useEffect, useState } from "react";

function Dashboard({ user, token, darkMode, toggleTheme, onBackToSearch, onLogout }) {
    const [likedBooks, setLikedBooks] = useState([]);
    const [readingList, setReadingList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await fetch("http://localhost:5000/api/dashboard", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Unable to load dashboard.");
                }

                setLikedBooks(data.likedBooks || []);
                setReadingList(data.readingList || []);
            } catch (err) {
                setError(err.message || "Unable to load dashboard.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [token]);

    const renderBooks = (books, emptyMessage) => {
    if (books.length === 0) {
        return <p className="dashboard-empty-message">{emptyMessage}</p>;
    }

    return (
        <ul className="dashboard-book-titles">
            {books.map((book) => (
                <li key={book.Book_ID}>{book.Title}</li>
            ))}
        </ul>
    );
    };

    return (
        <div className="search-page dashboard-page">
            <div className="top-buttons">
                <button type="button" className="theme-button" onClick={toggleTheme}>
                    {darkMode ? "Light Mode" : "Dark Mode"}
                </button>
                <button type="button" className="theme-button" onClick={onBackToSearch}>
                    Back to Search
                </button>
                <button type="button" className="theme-button" onClick={onLogout}>
                    Logout
                </button>
            </div>

            <main className="search-content">
                <h1>Page Turner</h1>
                <p>Your personal reading dashboard</p>
                {user && <p className="welcome-message">Welcome, {user.Name}!</p>}

                {loading && <p>Loading your dashboard...</p>}
                {error && <p className="search-error" role="alert">{error}</p>}

                {!loading && !error && (
                    <>
                        <section className="dashboard-section">
                            <h2>Books You Liked</h2>
                            {renderBooks(likedBooks, "You haven't liked any books yet.")}
                        </section>

                        <section className="dashboard-section">
                            <h2>Your Reading List</h2>
                            {renderBooks(readingList, "Your reading list is empty. Add books using the + button in search.")}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

export default Dashboard;
