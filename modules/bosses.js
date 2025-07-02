logic: (b, ctx, state, utils, gameHelpers) => {
        if (state.fractalHorrorSharedHp !== undefined) {
            b.hp = state.fractalHorrorSharedHp;
        }
        if (b.hp <= 0 || !state.fractalHorrorAi) return;

        const target = state.player;
        let allFractals = state.enemies.filter(e => e.id === 'fractal_horror');
        const hpPercent = state.fractalHorrorSharedHp / b.maxHP;
        const expectedSplits = Math.floor((1 - hpPercent) / 0.02);
        
        while (expectedSplits > state.fractalHorrorSplits && allFractals.length < 50) {
            let biggestFractal = allFractals.sort((a, b) => b.r - a.r)[0];
            if (!biggestFractal) break;

            gameHelpers.play('fractalSplit');
            utils.spawnParticles(state.particles, biggestFractal.x, biggestFractal.y, biggestFractal.color, 25, 3, 20);

            const newRadius = biggestFractal.r / Math.SQRT2;
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const child = gameHelpers.spawnEnemy(true, 'fractal_horror', {
                    x: biggestFractal.x + Math.cos(angle) * biggestFractal.r * 0.25,
                    y: biggestFractal.y + Math.sin(angle) * biggestFractal.r * 0.25
                });
                if (child) {
                    child.r = newRadius;
                    child.generation = biggestFractal.generation + 1;
                }
            }
            biggestFractal.hp = 0;
            state.fractalHorrorSplits++;
            allFractals = state.enemies.filter(e => e.id === 'fractal_horror');
        }

        const myIndex = allFractals.indexOf(b);
        const isLeader = myIndex === 0;

        if (isLeader) {
            const now = Date.now();
            const timeInState = now - state.fractalHorrorAi.lastStateChange;
            if (state.fractalHorrorAi.state === 'positioning' && timeInState > 4000) {
                state.fractalHorrorAi.state = 'attacking';
                state.fractalHorrorAi.attackTarget = { x: target.x, y: target.y };
                state.fractalHorrorAi.lastStateChange = now;
            } else if (state.fractalHorrorAi.state === 'attacking' && timeInState > 5000) {
                state.fractalHorrorAi.state = 'positioning';
                state.fractalHorrorAi.attackTarget = null;
                state.fractalHorrorAi.lastStateChange = now;
            }
        }
        
        if (!b.frozen) {
            let baseVelX, baseVelY;

            if (state.fractalHorrorAi.state === 'positioning') {
                if (myIndex !== -1) {
                    const totalFractals = allFractals.length;
                    const surroundRadius = 350 + totalFractals * 12;

                    const targetAngle = (myIndex / totalFractals) * 2 * Math.PI;
                    const targetX = target.x + surroundRadius * Math.cos(targetAngle);
                    const targetY = target.y + surroundRadius * Math.sin(targetAngle);
                    
                    baseVelX = (targetX - b.x) * 0.02;
                    baseVelY = (targetY - b.y) * 0.02;

                    allFractals.forEach(other => {
                        if (b === other) return;
                        const dist = Math.hypot(b.x - other.x, b.y - other.y);
                        const spacing = (b.r + other.r) * 0.8;
                        if (dist < spacing) {
                            const angle = Math.atan2(b.y - other.y, b.x - other.x);
                            const force = (spacing - dist) * 0.1;
                            b.x += Math.cos(angle) * force;
                            b.y += Math.sin(angle) * force;
                        }
                    });
                }
            } else if (state.fractalHorrorAi.state === 'attacking') {
                const attackTarget = state.fractalHorrorAi.attackTarget;
                if (attackTarget) {
                    const pullMultiplier = 0.015;

                    const vecX = attackTarget.x - b.x;
                    const vecY = attackTarget.y - b.y;
                    const dist = Math.hypot(vecX, vecY) || 1;
                    
                    const swirlForce = dist * 0.03;

                    const pullX = vecX * pullMultiplier;
                    const pullY = vecY * pullMultiplier;
                    
                    const perpX = -vecY / dist;
                    const perpY =  vecX / dist;
                    const spiralDirection = myIndex % 2 === 0 ? 1 : -1;
                    const swirlX = perpX * swirlForce * spiralDirection;
                    const swirlY = perpY * swirlForce * spiralDirection;

                    baseVelX = pullX + swirlX;
                    baseVelY = pullY + swirlY;
                }
            }

            // --- UNIVERSAL PROXIMITY BRAKE ---
            // This logic now applies to BOTH positioning and attacking phases.
            const distToPlayer = Math.hypot(b.x - state.player.x, b.y - state.player.y);
            const safetyRadius = 150;
            let slowingMultiplier = 1.0;

            if (distToPlayer < safetyRadius) {
                slowingMultiplier = Math.max(0.1, distToPlayer / safetyRadius);
            }
            
            if (baseVelX) b.x += baseVelX * slowingMultiplier;
            if (baseVelY) b.y += baseVelY * slowingMultiplier;
        }
        
        // --- DRAWING LOGIC (SIMPLIFIED) ---
        // The distracting pulsating glow effect has been removed.
        utils.drawCircle(ctx, b.x, b.y, b.r, b.color);

        if (b.frozen) {
            ctx.fillStyle = "rgba(173, 216, 230, 0.4)";
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, 2 * Math.PI);
            ctx.fill();
        }
    },
