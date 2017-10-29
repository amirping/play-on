<?php
$postreq= file_get_contents("php://input"); // obligatoire
$req = json_decode($postreq); // obligatoire
$token  = $req->token; // el parametre mte3ek eli b3athetha mel angular lel php

if ($token) {
  // te5dem 5edmtek
  }
  echo "ok"; // traja3 el message lel angular en cas kol chay cv
}
else {
  echo "no token found"; // traja3 el message lel angular en cas el param moch mawjod 
}
 ?>
