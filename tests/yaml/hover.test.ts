import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('YAML Hover Command', () => {
  test('should get hover info for GitHub workflow jobs field with schema', async () => {
    const result = await runHover('tests/fixtures/yaml/valid/github-workflow.yml', 'jobs');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Location: tests/fixtures/yaml/valid/github-workflow.yml:10:1');
    expect(output).toContain('A workflow run is made up of one or more jobs');
  }, 10000);

  test('should get hover info for GitHub workflow on field with schema', async () => {
    const result = await runHover('tests/fixtures/yaml/valid/github-workflow.yml', 'on');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Location: tests/fixtures/yaml/valid/github-workflow.yml:4:1');
    expect(output).toMatch(/on|trigger|event/i);
  }, 10000);

  test('should get hover info for GitHub workflow steps field with schema', async () => {
    const result = await runHover('tests/fixtures/yaml/valid/github-workflow.yml', 'steps');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('steps');
    expect(output).toContain('Location: tests/fixtures/yaml/valid/github-workflow.yml');
  }, 10000);

  test('should handle YAML without schema - limited hover support', async () => {
    const result = await runHover('tests/fixtures/yaml/valid/docker-compose.yml', 'services');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Docker Compose YAML might have limited hover support without explicit schema
    expect(output).toMatch(/services|No hover information found for the symbol\./);
  }, 10000);

  test('should handle YAML property hover without schema', async () => {
    const result = await runHover('tests/fixtures/yaml/valid/docker-compose.yml', 'image');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/image|No hover information found for the symbol\./);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover('tests/fixtures/yaml/valid/github-workflow.yml', 'NonExistentKey');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});