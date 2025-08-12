#!/usr/bin/env fish

function missing_end
    echo "hello"
# Missing 'end' keyword

if true
    echo "missing end"
# Missing 'end' keyword

set x (echo "unclosed parenthesis"