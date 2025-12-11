# Valid R script
hello_world <- function(name = "World") {
  greeting <- paste("Hello", name, "!")
  greeting
}

# Call the function
result <- hello_world("R")
print(result)

# Some basic R operations
numbers <- c(1, 2, 3, 4, 5)
squared <- numbers^2
mean_value <- mean(squared)

# Create a simple data frame
df <- data.frame(
  name = c("Alice", "Bob", "Charlie"),
  age = c(25, 30, 35),
  score = c(85.5, 92.0, 78.5)
)

# Summary
summary(df)