from typing import List

class Calculator:
    def __init__(self) -> None:
        self._history: List[float] = []
    
    def add(self, a: float, b: float) -> float:
        result = a + b
        self._history.append(result)
        return result
    
    def get_history(self) -> List[float]:
        return self._history.copy()
    
    def clear(self) -> None:
        self._history.clear()