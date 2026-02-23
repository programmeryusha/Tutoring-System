"use client"
import { useState } from "react";

export default function RegisterPage() {
    const [emailOrUsername, setemailOrUsername] = useState("");
    const [password, setPassword] = useState("");   
    const [msg, setMsg] = useState("");
    async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Logging in...");

    const r = await fetch("/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            emailorUsername: emailOrUsername,
            password
        }),
    });

    const data = await r.json();

    if (!r.ok) {
        return setMsg(data.error);
    }

    // Save user_id so other pages can read it
    localStorage.setItem("user_id", data.user_id);

    setMsg("Login successful! Redirecting...");

    // Go to sessions page
    window.location.href = "/";
}

    return (
        <main style={{ padding: 24, maxWidth: 480 }}>
            <h1>Login</h1>
            <form onSubmit={onSubmit}>
                <input placeholder = "Email or Username" value={emailOrUsername}
                    onChange={(e) => setemailOrUsername(e.target.value)} 
                    />
                <br/>
                <input placeholder = "Password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)} 
                    />
                <br/>
                <button type="submit">Login</button>
            </form>
            <p>{msg}</p>
        </main>
    );      
}