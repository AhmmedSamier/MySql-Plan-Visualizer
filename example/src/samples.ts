// MySQL Sample Execution Plans

const mysql_simple_index = `-> Index lookup on users using PRIMARY (id=100)  (cost=0.35 rows=1) (actual time=0.028..0.030 rows=1 loops=1)
`

const mysql_simple_index_query = `SELECT * FROM users WHERE id = 100;`

const mysql_join_example = `-> Nested loop inner join  (cost=1.10 rows=2) (actual time=0.045..0.062 rows=2 loops=1)
    -> Index lookup on users using PRIMARY (id=10)  (cost=0.35 rows=1) (actual time=0.025..0.026 rows=1 loops=1)
    -> Index lookup on orders using customer_id (customer_id=10)  (cost=0.75 rows=2) (actual time=0.018..0.033 rows=2 loops=1)
`

const mysql_join_query = `SELECT users.username, orders.order_date 
FROM users 
JOIN orders ON users.id = orders.customer_id 
WHERE users.id = 10;`

const mysql_aggregate_example = `-> Group aggregate: count(0)  (cost=4.50 rows=10) (actual time=0.125..0.150 rows=5 loops=1)
    -> Index scan on orders using status_idx  (cost=1.25 rows=30) (actual time=0.020..0.080 rows=30 loops=1)
`

const mysql_aggregate_query = `SELECT status, COUNT(*) FROM orders GROUP BY status;`

const mysql_subquery_example = `-> Filter: <in_optimizer>(users.id,users.id in (select #2))  (cost=2.25 rows=5) (actual time=0.080..0.120 rows=3 loops=1)
    -> Table scan on users  (cost=1.25 rows=10) (actual time=0.020..0.050 rows=10 loops=1)
    -> Select #2 (subquery)
        -> Filter: (orders.amount > 100)  (cost=0.75 rows=2) (actual time=0.030..0.045 rows=2 loops=1)
            -> Table scan on orders  (cost=0.75 rows=5) (actual time=0.015..0.025 rows=5 loops=1)
`

const mysql_subquery_query = `SELECT * FROM users WHERE id IN (SELECT id FROM orders WHERE amount > 100);`

const mysql_table_scan = `-> Filter: (users.email like '%@gmail.com')  (cost=2.50 rows=2) (actual time=0.150..0.210 rows=3 loops=1)
    -> Table scan on users  (cost=2.50 rows=20) (actual time=0.040..0.135 rows=20 loops=1)
`

const mysql_table_scan_query = `SELECT * FROM users WHERE email LIKE '%@gmail.com';`

const mysql_complex_join = `-> Nested loop inner join  (cost=3.55 rows=4) (actual time=0.120..0.210 rows=4 loops=1)
    -> Nested loop inner join  (cost=1.75 rows=2) (actual time=0.060..0.105 rows=2 loops=1)
        -> Index lookup on users using PRIMARY (id=42)  (cost=0.35 rows=1) (actual time=0.030..0.032 rows=1 loops=1)
        -> Index lookup on orders using customer_id (customer_id=42)  (cost=1.15 rows=2) (actual time=0.025..0.065 rows=2 loops=1)
    -> Index lookup on order_items using order_id (order_id=orders.id)  (cost=0.75 rows=2) (actual time=0.020..0.045 rows=2 loops=1)
`

const mysql_complex_join_query = `SELECT u.username, o.order_date, oi.product_name 
FROM users u 
JOIN orders o ON u.id = o.customer_id 
JOIN order_items oi ON o.id = oi.order_id 
WHERE u.id = 42;`

export const samples: [string, string, string][] = [
  ["Simple Index Lookup", mysql_simple_index, mysql_simple_index_query],
  ["JOIN with Filter", mysql_join_example, mysql_join_query],
  ["Aggregate with GROUP BY", mysql_aggregate_example, mysql_aggregate_query],
  ["Subquery with IN", mysql_subquery_example, mysql_subquery_query],
  ["Table Scan (Missing Index)", mysql_table_scan, mysql_table_scan_query],
  ["Complex 3-Table JOIN", mysql_complex_join, mysql_complex_join_query],
]

export default samples
