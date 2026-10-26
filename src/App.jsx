import { useState } from "react";
import Login from "./pages/Login";
import Search from "./pages/Search";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function App() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [darkMode, setDarkMode] = useState(false);
    const [currentPage, setCurrentPage] = useState("search");

    const handleLogin = (userData, authToken) => {
        setUser(userData);
        setToken(authToken);
        setCurrentPage("search");
    };

    const handleLogout = () => {
        setUser(null);
        setToken(null);
        setCurrentPage("search");
    };

    const toggleTheme = () => {
        setDarkMode((previous) => !previous);
    };

    return (
        <div className={darkMode ? "app dark-mode" : "app"}>
            {user && token ? (
                currentPage === "dashboard" ? (
                    <Dashboard
                        user={user}
                        token={token}
                        darkMode={darkMode}
                        toggleTheme={toggleTheme}
                        onBackToSearch={() => setCurrentPage("search")}
                        onLogout={handleLogout}
                    />
                ) : (
                    <Search
                        darkMode={darkMode}
                        toggleTheme={toggleTheme}
                        onLogout={handleLogout}
                        onDashboard={() => setCurrentPage("dashboard")}
                        user={user}
                        token={token}
                    />
                )
            ) : (
                <Login
                    onLogin={handleLogin}
                    darkMode={darkMode}
                    toggleTheme={toggleTheme}
                />
            )}
        </div>
    );
}

export default App;
