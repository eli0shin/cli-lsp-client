# Valid R analysis script
library(stats)

# Function to perform basic statistical analysis
analyze_data <- function(data_vector) {
  # Basic statistics
  list(
    mean = mean(data_vector, na.rm = TRUE),
    median = median(data_vector, na.rm = TRUE),
    sd = sd(data_vector, na.rm = TRUE),
    min = min(data_vector, na.rm = TRUE),
    max = max(data_vector, na.rm = TRUE)
  )
}

# Generate sample data
set.seed(123)
sample_data <- rnorm(100, mean = 50, sd = 10)

# Perform analysis
analysis_result <- analyze_data(sample_data)

# Print results
for (stat_name in names(analysis_result)) {
  cat(sprintf("%s: %.2f\n", stat_name, analysis_result[[stat_name]]))
}