def type_error(name: str) -> str:
    # Type error: returning int instead of str
    return 42

def another_error() -> None:
    x: str = 123  # Type error: int assigned to str variable