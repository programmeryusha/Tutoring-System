"use client"
import { useState } from "react";

// making the functions for the register page, we will assign them in the browser
export default function RegisterPage() {
    // function for changing states of the boxes
    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
    });

    // function for changing the message on the page
    const [msg, setMsg] = useState("");
    // function for handling the register
    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg("Registering...");
        const r = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(form),
        });
        const data = await r.json();
        if (r.ok) {
            setMsg("Registered successfully! Please log in.");
        } else {
            setMsg(data.error);
        }
    }

    // the actual page
    return (
        <main style={{ padding: 24, maxWidth: 480 }}>
            <h1>Register</h1>
            <form onSubmit={onSubmit}>
                <input placeholder = "Username" value={(form.username)}
                    onChange={(e) => setForm({ ...form, username: e.target.value })} 
                    />
                <br/>
                <input placeholder = "Email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} 
                    />
                <br/>
                <input placeholder = "Password" type="password" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} 
                    />
                <br/>
                <button type="submit">Register</button>
            </form>
            <p>{msg}</p>
        </main>
    );
}