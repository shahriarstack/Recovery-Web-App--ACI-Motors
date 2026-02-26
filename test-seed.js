const init = async () => {
    const rawTerritories = [
        { part: 'A', name: 'Bogura' }, { part: 'A', name: 'Chapainawabgonj' }
    ];
    const territories = rawTerritories.map((t) => ({
        id: t.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
        name: t.name,
        part: t.part,
        officer: t.name
    }));
    const users = [
        ...territories.map(t => ({
            username: t.name,
            officerName: `${t.name} Officer`,
            role: 'officer',
            password: '1234',
            territoryId: t.id
        }))
    ];

    try {
        console.log("Syncing targets...");
        const res1 = await fetch('http://localhost:3000/api/sync-targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ territories, targets: [] })
        });
        console.log("Targets status:", res1.status, await res1.text());

        console.log("Syncing users...");
        const res2 = await fetch('http://localhost:3000/api/sync-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users })
        });
        console.log("Users status:", res2.status, await res2.text());

        console.log("Fetching DB...");
        const res3 = await fetch('http://localhost:3000/api/db');
        console.log("DB status:", res3.status);
    } catch (e) {
        console.error("Test failed", e);
    }
};

init();
