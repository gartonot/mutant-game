import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bullet } from '../src/entities/bullet/Bullet';
import { Beam } from '../src/entities/bullet/Beam';
import { Grenade } from '../src/entities/bullet/Grenade';
import { ChainLightning, Disc } from '../src/entities/bullet/SpecialProjectiles';
import { Flame } from '../src/entities/bullet/Flame';
import { getArenaSize } from '../src/gameplay/Arena';
import { segmentHit } from '../src/systems/spatial/segmentHit';

test('moving projectiles stop at the viewport boundary and preserve their final collision segment', () => {
    const { height } = getArenaSize();
    const angle = Math.PI / 4;
    for (const shot of [
        new Bullet(100, height - 10, angle, 1, 100),
        new Disc(100, height - 10, angle, 1, 100, 0),
        new Flame(100, height - 10, angle, 100),
    ]) {
        shot.update();
        assert.equal(shot.expired, true);
        assert.equal(shot.isDead, false, 'collision system must still process the final swept path');
        assert.ok(Math.abs(shot.x - 110) < 1e-8, 'diagonal motion stops at the boundary intersection');
        assert.equal(shot.y, height);
        assert.equal(shot.previousY, height - 10);
        assert.notEqual(segmentHit(shot.previousX, shot.previousY, shot.x, shot.y, 105, height - 5, 1), null);
    }
});

test('all grenade variants detonate exactly at the playable arena boundary', () => {
    const { height } = getArenaSize();
    for (const variant of ['normal', 'skull', 'plasma'] as const) {
        const grenade = new Grenade(100, height - 3, Math.PI / 2, 10, 30, 0, variant);
        grenade.update();
        assert.equal(grenade.detonated, true);
        assert.equal(grenade.y, height);
        assert.equal(grenade.previousY, height - 3);
        grenade.update();
        assert.equal(grenade.y, height, 'detonated grenade cannot continue outside the viewport');
    }
});

test('instant beams and Tesla rays end at the arena boundary', () => {
    const { height } = getArenaSize();
    for (const shot of [new Beam(100, height - 20, Math.PI / 2, 1, 0, false),
        new Beam(100, height - 20, Math.PI / 2, 1, 0, true),
        new ChainLightning(100, height - 20, Math.PI / 2, 1, 10, 0)]) {
        assert.equal(shot.y, height);
        assert.equal(shot.previousY, height - 20);
    }
    const beam = new Beam(100, 100, 0, 1, 0, false);
    beam.aim(100, height - 5, Math.PI / 2);
    assert.equal(beam.y, height, 'continuous aim also uses the arena boundary');
});

test('a muzzle extending below the arena cannot create a projectile outside the viewport', () => {
    const { height } = getArenaSize();
    const bullet = new Bullet(100, height + 20, Math.PI / 2);
    assert.equal(bullet.y, height);
    bullet.update();
    assert.equal(bullet.y, height);
    assert.equal(bullet.expired, true);
    const beam = new Beam(100, height + 20, Math.PI / 2, 1, 0, false);
    assert.equal(beam.previousY, height);
    assert.equal(beam.y, height);
});
