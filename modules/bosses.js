// modules/bosses.js
// DIAGNOSTIC VERSION: Contains only the first boss to isolate the syntax error.

export const bossData=[
    { 
        id:"splitter", 
        name:"Splitter Sentinel", 
        color:"#ff4500", 
        maxHP: 150, 
        onDeath: (b, state, spawnEnemy, spawnParticles) => { 
            spawnParticles(b.x, b.y, "#ff4500", 100, 6, 40, 5); 
            const spawnInCircle = (count, radius, center) => { 
                for(let i=0; i<count; i++) { 
                    const angle = (i / count) * 2 * Math.PI + Math.random() * 0.5; 
                    const spawnX = center.x + Math.cos(angle) * radius; 
                    const spawnY = center.y + Math.sin(angle) * radius; 
                    const newEnemy = spawnEnemy(false, null, { x: spawnX, y: spawnY }); 
                    if (state.arenaMode && newEnemy) newEnemy.targetBosses = true; 
                } 
            }; 
            spawnInCircle(6, 60, b); 
            setTimeout(() => spawnInCircle(6, 120, b), 1000); 
        } 
    }
];
