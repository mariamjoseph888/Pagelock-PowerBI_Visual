# PageLock

A Power BI custom visual: an email + password gate for protected pages or visuals. After a correct sign-in it filters the bound Access table to that email, and a measure uses that filter to unlock the protected visuals.

> **This is a convenience lock, not security.** The data stays in the model. Hashes live in the report, and anyone with edit rights or a copy of the .pbix can bypass it. Never use "Publish to web". Use Row-Level Security for confidential data. The visual was not tested in Power BI Desktop/service by its author, so try it on a copy first.

## Fields
- **Email**: `Access[Email]`
- **Password hash**: `Access[PasswordHash]`

Hash = `SHA-256( salt + ":" + lowercase(trim(email)) + ":" + password )`, lowercase hex. Default salt `pagelock`. Set your own under Format, Lock settings, and never change it afterwards (all hashes would stop working).

## Use
1. Import `PageLock.pbiviz` into your report.
2. Create an `Access` table with `Email` and `PasswordHash` (optional `Groups`, `;`-separated).
3. Turn on Format, `Show hash generator` once to make hashes, then turn it off.
4. Add the measure, then use it as a visual-level filter ("is 1") on every visual to protect. Slicers cannot take measure filters, so they stay unprotected.

```DAX
Unlocked = IF ( HASONEVALUE ( Access[Email] ), 1, 0 )
```

Optional banner:

```DAX
Lock Message = IF ( [Unlocked] = 1, BLANK (), "Locked. Enter your email and password above." )
```

Optional groups, one measure per group:

```DAX
Unlocked Audit =
IF ( HASONEVALUE ( Access[Email] )
     && CONTAINSSTRING ( ";" & SELECTEDVALUE ( Access[Groups] ) & ";", ";Audit;" ), 1, 0 )
```

## Notes
- 5 wrong attempts trigger a 30-second client-side cooldown.
- Click Lock before saving or publishing, then test with another account. The unlock is held like a slicer selection, so a saved report may open unlocked.
- Use a long password and your own salt: weak passwords can be guessed from the hash column.

## Build
```
npm install
pbiviz package
```

## License
MIT
