(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-FUND-NOT-FOUND u101)
(define-constant ERR-FUND-ALREADY-EXISTS u102)
(define-constant ERR-INVALID-NAME u103)
(define-constant ERR-INVALID-GOAL u104)
(define-constant ERR-INVALID-STATUS u105)
(define-constant ERR-INVALID-CREATOR u106)
(define-constant ERR-INVALID-LOCATION u107)
(define-constant ERR-INVALID-CURRENCY u108)
(define-constant ERR-INVALID-TIMESTAMP u109)
(define-constant ERR-MAX-FUNDS-EXCEEDED u110)
(define-constant ERR-REGISTRY-LOCKED u111)

(define-data-var next-fund-id uint u0)
(define-data-var max-funds uint u1000)
(define-data-var registry-locked bool false)

(define-map funds-registry
  uint
  {
    name: (string-ascii 50),
    goal: uint,
    creator: principal,
    location: (string-ascii 50),
    currency: (string-ascii 10),
    timestamp: uint,
    active: bool
  })

(define-map fund-id-by-name
  (string-ascii 50)
  uint)

(define-map fund-names
  uint
  (string-ascii 50))

(define-read-only (get-fund-by-id (id uint))
  (map-get? funds-registry id))

(define-read-only (get-fund-id-by-name (name (string-ascii 50)))
  (map-get? fund-id-by-name name))

(define-read-only (get-fund-name (id uint))
  (map-get? fund-names id))

(define-read-only (is-fund-registered (name (string-ascii 50)))
  (is-some (map-get? fund-id-by-name name)))

(define-read-only (get-total-funds)
  (ok (var-get next-fund-id)))

(define-read-only (is-registry-locked)
  (ok (var-get registry-locked)))

(define-private (validate-name (name (string-ascii 50)))
  (if (and (> (len name) u0) (<= (len name) u50))
      (ok true)
      (err ERR-INVALID-NAME)))

(define-private (validate-goal (goal uint))
  (if (> goal u0)
      (ok true)
      (err ERR-INVALID-GOAL)))

(define-private (validate-location (loc (string-ascii 50)))
  (if (and (> (len loc) u0) (<= (len loc) u50))
      (ok true)
      (err ERR-INVALID-LOCATION)))

(define-private (validate-currency (cur (string-ascii 10)))
  (if (or (is-eq cur "STX") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY)))

(define-private (validate-creator (creator principal))
  (if (not (is-eq creator tx-sender))
      (ok true)
      (err ERR-INVALID-CREATOR)))

(define-public (register-fund
  (id uint)
  (name (string-ascii 50))
  (goal uint)
  (creator principal))
  (let ((current-id (var-get next-fund-id)))
    (asserts! (not (var-get registry-locked)) (err ERR-REGISTRY-LOCKED))
    (asserts! (is-eq id current-id) (err ERR-NOT-AUTHORIZED))
    (try! (validate-name name))
    (try! (validate-goal goal))
    (try! (validate-creator creator))
    (asserts! (is-none (map-get? fund-id-by-name name)) (err ERR-FUND-ALREADY-EXISTS))
    (asserts! (<= current-id (var-get max-funds)) (err ERR-MAX-FUNDS-EXCEEDED))
    (map-set funds-registry id
      {name: name, goal: goal, creator: creator, location: "", currency: "STX", timestamp: block-height, active: true})
    (map-set fund-id-by-name name id)
    (map-set fund-names id name)
    (var-set next-fund-id (+ id u1))
    (ok true)))

(define-public (update-fund-metadata
  (id uint)
  (location (string-ascii 50))
  (currency (string-ascii 10)))
  (let ((fund (unwrap! (map-get? funds-registry id) (err ERR-FUND-NOT-FOUND))))
    (asserts! (is-eq (get creator fund) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (get active fund) (err ERR-INVALID-STATUS))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (map-set funds-registry id
      (merge fund {location: location, currency: currency}))
    (ok true)))

(define-public (deactivate-fund (id uint))
  (let ((fund (unwrap! (map-get? funds-registry id) (err ERR-FUND-NOT-FOUND))))
    (asserts! (is-eq (get creator fund) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (get active fund) (err ERR-INVALID-STATUS))
    (map-set funds-registry id (merge fund {active: false}))
    (ok true)))

(define-public (reactivate-fund (id uint))
  (let ((fund (unwrap! (map-get? funds-registry id) (err ERR-FUND-NOT-FOUND))))
    (asserts! (is-eq (get creator fund) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get active fund)) (err ERR-INVALID-STATUS))
    (map-set funds-registry id (merge fund {active: true}))
    (ok true)))

(define-public (lock-registry)
  (begin
    (asserts! (is-eq tx-sender (as-contract tx-sender)) (err ERR-NOT-AUTHORIZED))
    (var-set registry-locked true)
    (ok true)))

(define-public (set-max-funds (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (as-contract tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max (var-get next-fund-id)) (err ERR-INVALID-GOAL))
    (var-set max-funds new-max)
    (ok true)))

(define-public (get-all-fund-ids (offset uint) (limit uint))
  (let ((total (var-get next-fund-id)))
    (ok (fold append
      (map (lambda (i) (if (and (>= i offset) (< i (+ offset limit)) (is-some (get-fund-by-id i))) (list i) (list)))
           (range total))
      (list)))))

(define-public (search-funds-by-name-prefix (prefix (string-ascii 10)))
  (let ((all-names (map (lambda (id) (get-fund-name id)) (range (var-get next-fund-id)))))
    (ok (filter (lambda (name) (and (is-some name) (is-prefix prefix (unwrap! name "none")))) all-names))))