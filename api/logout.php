<?php
// POST -> 204; deletes the session row and clears the cookie.

require __DIR__ . '/lib.php';

require_method('POST');
require_csrf_header();

$token = $_COOKIE[SESSION_COOKIE] ?? '';
if ($token !== '') {
	db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
}
set_session_cookie('', 0);
respond(204, null);
