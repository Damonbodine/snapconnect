SELECT id, username, full_name, is_mock_user, created_at 
FROM users WHERE is_mock_user = TRUE ORDER BY created_at;
EOF < /dev/null