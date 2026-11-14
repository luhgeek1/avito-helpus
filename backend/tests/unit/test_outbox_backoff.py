from datetime import timedelta

from app.service.outbox import retry_delay


def test_retry_delay_grows_exponentially_and_is_capped() -> None:
    assert [retry_delay(n).total_seconds() for n in (1, 2, 3)] == [2, 4, 8]
    assert retry_delay(30) == timedelta(hours=1)
