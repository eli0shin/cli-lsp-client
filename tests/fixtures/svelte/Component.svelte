<script>
  // Svelte component with intentional errors
  let name = 'world';
  let count;
  
  // Type error - using undefined variable
  let result = undefinedVariable + 1;
  
  // Wrong function call
  nonExistentFunction();
  
  function increment() {
    count += 1;
  }
</script>

<main>
  <h1>Hello {name}!</h1>
  <p>Count: {count}</p>
  <button on:click={increment}>Increment</button>
  
  <!-- Invalid HTML structure -->
  <div>
    <span>Unclosed div
  </div>
  
  <!-- Missing closing tag -->
  <p>This paragraph is missing closing tag
</main>