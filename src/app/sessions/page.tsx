"use client"
import { useState, useEffect } from "react";

export default function SessionsPage() {
    const [userID, setUserID] = useState("");
    const [msg, setMsg] = useState("");
    const [sessions, setSessions] = useState<any[]>([]);
    const [skills, setSkills] = useState([]);
    const [form, setForm] = useState({ skill_id: "", scheduled_at: "", duration_minutes: 60 });
    // using the front end to find the user_id since that is the input we need for getting the rest of the info

    useEffect(() => {
        const id = localStorage.getItem("user_id");
        setUserID(id);
    }, []);

    useEffect(() => {
        if (!userID) return;
        (async () => {
            const s = await fetch(`/api/sessions?user_id=${userID}`).then((r) => r.json());
      setSessions(s.sessions || []);
    })();
    }, [userID]);

    async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!userID) return;

    if (!form.scheduled_at) {
        return setMsg("Please enter valid date and time.");
    }

    const isoDate = new Date(form.scheduled_at).toISOString();

    const r = await fetch("/api/sessions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            ...form,
            student_id: userID,
            scheduled_at: isoDate
        }),
    });

    const data = await r.json();

    if (!r.ok) {
        return setMsg(data.error);
    }

    const s = await fetch(`/api/sessions?user_id=${userID}`)
        .then((rr) => rr.json());

    setSessions(s.sessions || []);
}
    return (
        <main style={{ padding: 24, maxWidth: 480 }}>
            <h1>Sessions</h1>
            <p>User:{userID || "Not logged in (go to /login)"}</p>

            <h2>Book a Session</h2>
            <form onSubmit={createSession}>
                <input placeholder="Skill ID" value={form.skill_id}
                    onChange={(e) => setForm({ ...form, skill_id: e.target.value })}
                />
                <br />
                <input type='datetime-local' value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                />
                <br />
                <input placeholder="Duration (minutes)" value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                />
                <br />
                <button type="submit">Book Session</button>
            </form>
            <p>{msg}</p>

            <h2>Your Sessions</h2>
            <ul>
                {sessions.map((s) => (
                    <li key={s.session_id}>
                        {s.skill_name} with tutor {s.tutor_id} at {new Date(s.scheduled_at).toLocaleString()} for {s.duration_minutes} minutes
                    </li>
                ))}
            </ul>
        </main>
    );
}