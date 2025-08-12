public class HelloWorld {
    private static final String GREETING = "Hello, World!";
    
    public static void main(String[] args) {
        HelloWorld app = new HelloWorld();
        app.printGreeting();
        
        if (args.length > 0) {
            app.printCustomGreeting(args[0]);
        }
    }
    
    public void printGreeting() {
        System.out.println(GREETING);
    }
    
    public void printCustomGreeting(String name) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Name cannot be null or empty");
        }
        System.out.printf("Hello, %s!%n", name);
    }
}