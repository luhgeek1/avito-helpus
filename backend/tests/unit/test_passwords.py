from app.core.security.passwords import hash_password, needs_rehash, verify_password


async def test_hash_and_verify() -> None:
    hashed = await hash_password("s3cret-pass")

    assert hashed.startswith("$argon2id$")
    assert await verify_password("s3cret-pass", hashed)
    assert not await verify_password("wrong-pass", hashed)
    assert not needs_rehash(hashed)


async def test_unknown_user_never_verifies() -> None:
    assert not await verify_password("anything", None)


async def test_garbage_hash_does_not_raise() -> None:
    assert not await verify_password("anything", "not-a-hash")
