
import { useState } from "react";

function Login({ onLogin, darkMode, toggleTheme }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!email.trim() || !password || (isRegistering && !name.trim())) {
            setError("Please fill in all required fields.");
            return;
        }

        if (isRegistering && password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        setLoading(true);

        try {
            const endpoint = isRegistering
                ? "register"
                : "login";

            const body = isRegistering
                ? { Name: name.trim(), Email: email.trim(), Password: password }
                : { Email: email.trim(), Password: password };

            const response = await fetch(
                `http://localhost:5000/api/auth/${endpoint}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong.");
            }

            if (isRegistering) {
                setError("");
                setIsRegistering(false);
                setPassword("");
                setName("");
                alert("Account created successfully! Please log in.");
            } else {
                onLogin(data.user, data.token);
            }
        } catch (err) {
            setError(
                err.message || "Unable to connect to the server."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <button
                className="login-theme-button"
                onClick={toggleTheme}
                type="button"
            >
                {darkMode ? "Light Mode" : "Dark Mode"}
            </button>

            <div className="login-box">
                <h1>Page Turner</h1>

                <p className="login-subtitle">
                    Your personal book library
                </p>

                <h2>{isRegistering ? "Create Account" : "Login"}</h2>

                <form onSubmit={handleSubmit}>
                    {isRegistering && (
                        <>
                            <label htmlFor="name">Name</label>
                            <input
                                id="name"
                                type="text"
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={100}
                                required
                            />
                        </>
                    )}

                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={150}
                        autoComplete="email"
                        required
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={
                            isRegistering
                                ? "new-password"
                                : "current-password"
                        }
                        required
                    />

                    {error && (
                        <p className="search-error" role="alert">
                            {error}
                        </p>
                    )}

                    <button type="submit" disabled={loading}>
                        {loading
                            ? "Please wait..."
                            : isRegistering
                                ? "Register"
                                : "Login"}
                    </button>
                </form>

                <p>
                    {isRegistering
                        ? "Already have an account?"
                        : "Don't have an account?"}
                    {" "}
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError("");
                            setPassword("");
                        }}
                    >
                        {isRegistering ? "Login" : "Register"}
                    </button>
                </p>
            </div>
        </div>
    );
}

export default Login;
