# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - heading "Register" [level=1] [ref=e3]
    - generic [ref=e4]:
      - textbox "Username" [ref=e5]: testuser
      - textbox "Email" [ref=e6]: testuser@example.com
      - textbox "Password" [ref=e7]: testpassword
      - button "Register" [active] [ref=e8]
    - paragraph [ref=e9]: Registering...
  - generic [ref=e14] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e15]:
      - img [ref=e16]
    - generic [ref=e19]:
      - button "Open issues overlay" [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: "0"
          - generic [ref=e23]: "1"
        - generic [ref=e24]: Issue
      - button "Collapse issues badge" [ref=e25]:
        - img [ref=e26]
  - alert [ref=e28]
```