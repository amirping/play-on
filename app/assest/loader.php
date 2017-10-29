<?php
$postreq= file_get_contents("php://input");
$req = json_decode($postreq); // $req bech tal9a feha el data eli bech tab3thom el kol mel angular

$msg = $req->msg ; // lena 9rina data esmha msg
if ($msg == "hello") {
  echo "ahla bik degla ";
}
else {
  echo "wala ma3rftek frere";
}
?>
