"""Test file for Python class hover with type annotations"""
from typing import List, Dict, Optional, Union
from dataclasses import dataclass

@dataclass
class Person:
    """A person with various attributes for testing type expansion"""
    id: int
    name: str
    age: int
    email: str
    tags: List[str]
    metadata: Optional[Dict[str, Union[str, int]]]
    
    def greet(self) -> str:
        """Return a greeting message"""
        return f"Hello, I'm {self.name}"
    
    def add_tag(self, tag: str) -> None:
        """Add a tag to the person's tag list"""
        self.tags.append(tag)
    
    def get_metadata_value(self, key: str) -> Optional[Union[str, int]]:
        """Get a value from metadata by key"""
        if self.metadata:
            return self.metadata.get(key)
        return None


class DataProcessor:
    """A class with complex method signatures for testing"""
    
    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        self.data: List[Dict[str, Union[str, int, float]]] = []
    
    def process_batch(
        self, 
        items: List[Dict[str, Any]], 
        filter_func: Optional[Callable[[Dict[str, Any]], bool]] = None
    ) -> List[Dict[str, Any]]:
        """Process a batch of items with optional filtering"""
        if filter_func:
            items = [item for item in items if filter_func(item)]
        self.data.extend(items)
        return items
    
    def aggregate_data(self) -> Dict[str, Union[int, float, List[str]]]:
        """Aggregate the processed data"""
        return {
            'count': len(self.data),
            'keys': list(self.data[0].keys()) if self.data else []
        }


# Import Any and Callable for the class
from typing import Any, Callable

# Create instances for testing
person = Person(
    id=1,
    name="Alice",
    age=30,
    email="alice@example.com",
    tags=["developer", "python"],
    metadata={"department": "Engineering", "level": 3}
)

processor = DataProcessor({"batch_size": 100, "timeout": 30})